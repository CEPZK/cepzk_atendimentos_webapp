-- contract: see ../CONTRACT.sha256 — pin that value in your migration header (backend repo)
-- =============================================================================
-- 0001_identity.sql — domain-agnostic identity layer. Safe to apply today.
-- Copy verbatim into the backend repo as supabase/migrations/<ts>_identity.sql
-- (do not renumber: the timestamp prefix is what supabase migration list uses).
--
-- Owned here: profiles <-> auth.users mirror, role model, RLS helper functions.
-- Intentionally NOT here: any domain table (see 0002_domain.pending.sql).
-- =============================================================================

-- ── 0. extensions ────────────────────────────────────────────────────────────
-- citext backs the unique email (case-insensitive equality), so `A@x.com` and
-- `a@x.com` cannot both exist and bypass the uniqueness the login flow assumes.
-- `with schema extensions` matches Supabase's layout; plain CREATE EXTENSION
-- would drop it into public and break `supabase inspect db extensions`.
create extension if not exists citext with schema extensions;

-- ── 1. enums ─────────────────────────────────────────────────────────────────
-- No CREATE TYPE IF NOT EXISTS in Postgres, so guard via catalog. Re-running a
-- migration during `supabase db reset` then fails loudly for the *right* reason
-- instead of half-applying.
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role'
  ) then
    create type public.app_role as enum ('admin', 'staff', 'client');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'profile_status'
  ) then
    create type public.profile_status as enum ('invited', 'active', 'disabled');
  end if;
end
$$;

-- ── 2. shared trigger: updated_at ────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── 3. profiles: read model of auth.users ────────────────────────────────────
-- auth.users is not selectable from the API, so every join in the app needs a
-- mirror. Roles are NOT a column here: the source of truth is
-- auth.users.app_metadata->>'role' (immutable from the client, read from the
-- JWT in O(1)). Duplicating it here would create two answers to "who is this?".
create table if not exists public.profiles (
  id           uuid primary key,           -- = auth.users.id, no surrogate key
  email        citext not null unique,
  display_name text,
  avatar_url   text,
  phone        text,
  status       public.profile_status not null default 'invited',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_email_length check (char_length(email) <= 320),
  constraint profiles_name_length  check (display_name is null or char_length(display_name) <= 120)
);

comment on table public.profiles is
  'App-visible projection of auth.users. Inserted by trigger; email/status admin-only via guard trigger.';
comment on column public.profiles.status is
  'invited = never completed first sign-in. disabled = sign-in blocked AND every policy denies reads (see is_active_member).';

create index if not exists profiles_status_idx on public.profiles (status);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── 4. keep profiles in sync with auth.users ─────────────────────────────────
-- Runs as definer because the invoker (the Auth service) has no insert grant
-- on public.profiles, and `search_path=''` because a security-definer function
-- that resolves names from a caller-influenced search_path is privilege
-- escalation via a temp-table shadow.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    -- Email not yet confirmed => cannot be treated as an active member.
    case when new.email_confirmed_at is not null then 'active' else 'invited' end
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mirror deletes so an orphan row cannot be re-attached to a recycled uuid.
create or replace function public.handle_user_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.handle_user_delete();

-- ── 5. policy helpers ────────────────────────────────────────────────────────
-- `stable` matters: without it the planner re-executes per row. `set
-- search_path=''` is required because these are called from policies, which are
-- evaluated in the caller's search path.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
set search_path = ''
as $$
  select case x
    when 'admin' then 'admin'::public.app_role
    when 'staff' then 'staff'::public.app_role
    when 'client' then 'client'::public.app_role
    else null
  end
  from (select auth.jwt() -> 'app_metadata' ->> 'role' as x) s;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.current_app_role() in ('admin', 'staff');
$$;

-- Definer: a disabled user must not be able to make themselves "active" by
-- reading their own row through the same policy that calls this.
create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

-- ── 6. privilege guard on profiles ───────────────────────────────────────────
-- RLS has no column-level granularity, so "users can edit their own profile but
-- not their status" is enforced here. Errcode 42501 (insufficient_privilege) so
-- it never reads as a server fault to the client.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.email is distinct from old.email
     or new.status is distinct from old.status then
    raise exception 'email and status are administrator-only fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ── 7. grants ────────────────────────────────────────────────────────────────
-- Supabase grants `all` on new public tables to anon/authenticated via default
-- privileges. Being explicit here is the point: a table the client should never
-- write must have the capability revoked, not merely lack a policy.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, phone) on public.profiles to authenticated;
-- insert/delete are Edge-Function (service role) only.

-- ── 8. RLS ───────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
-- Deliberately NOT `force row level security`: is_active_member() is a definer
-- function that reads this table. Forcing RLS on the owner makes that read
-- subject to the same policy, and Postgres answers with
-- "infinite recursion detected in policy for relation profiles".

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.is_admin()
  );
-- NOTE: no is_active_member() here on purpose. A disabled user must still be
-- able to read their own profile so the app can render "your access was
-- revoked" instead of an empty screen. Every *other* table's policy requires it.

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- `with check` blocks the "update someone else's row via a self-scoped policy"
-- trick where the id is swapped in the same statement.

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
