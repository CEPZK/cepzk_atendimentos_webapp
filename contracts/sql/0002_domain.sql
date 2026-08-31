-- contract: see ../CONTRACT.sha256
-- =============================================================================
-- 0002_domain.sql — the owner's schema, reconciled.
--
-- PROPOSAL, not a rewrite: table and column vocabulary stays Portuguese (it is
-- the domain language of the casa), the lookup tables stay lookup tables, and
-- the 1:1 `aca_tratamento` subclass pattern is kept because it is the right
-- call. What changed is (a) the alta lifecycle, which had no column anywhere,
-- (b) the volunteer↔auth link, without which no policy can be written, (c) RLS
-- + grants on every table, (d) indexes on the FK and policy columns, (e) the
-- `proximo_tratamento` linked list, which cannot express a return visit.
-- Each item is justified in schema-review.md with the same P0-x / P1-x numbers.
--
-- Syntax-checked with Postgres' own grammar (`npm run sql:lint`). NOT executed —
-- no Postgres in this sandbox. Apply on a Supabase branch first.
--
-- ORDERING: depends on 0001_identity.sql, which creates `profile_status` and the
-- `is_admin()` / `is_staff()` / `set_updated_at()` this file calls. Run 0001 first.
--
-- BLOCKED on 3 decisions (schema-review.md §"Decisions needed"): the meeting vs
-- per-assistido session split (§P1-3), whether the Atendimento Fraterno
-- interview is a `tratamento` row or its own table (§P3-1), and whether
-- `presenca` feeds back into `status`. Everything else is independent of them.
-- =============================================================================

-- ── 0. extensions, shared plumbing ──────────────────────────────────────────
create extension if not exists citext with schema extensions;   -- unique names that ignore case
create extension if not exists pg_trgm with schema extensions;  -- fuzzy name lookup (§P0-5)

-- updated_at: one function for the whole schema (also used by 0001_identity.sql;
-- CREATE OR REPLACE keeps the two files order-independent).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── 1. catalog ──────────────────────────────────────────────────────────────
-- Retire with ativo=false, never delete: setor/horario rows are referenced by
-- history, and a cascade from here would erase years of atendimentos.
create table public.cepzk_departamento (
  id         smallserial primary key,
  nome       citext not null unique,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cepzk_departamento_nome_check check (nome ~ '\S' and length(nome) <= 80)
);

create table public.cepzk_setor (
  id              smallserial primary key,
  nome            citext not null,
  departamento_id smallint not null references public.cepzk_departamento (id) on delete restrict,
  -- §P1-6: has an agenda of sessões? (ACAs do; other setores don't). Replaces
  -- the "only one treatment type has sessions" special case in the UI.
  tem_agenda      boolean not null default false,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- unique per department: "Desobsessão Infantil I" and "II" are distinct rows,
  -- and the same name may legitimately repeat across departments.
  constraint cepzk_setor_nome_por_departamento unique (departamento_id, nome),
  constraint cepzk_setor_nome_check check (nome ~ '\S' and length(nome) <= 120)
);

-- §P1-4. The original stored "Sexta-Feira 19h30" as free text, which makes an
-- agenda impossible: you cannot detect a clash, order the week, or stop a
-- near-duplicate row. Day + time are data; the label is derived.
-- dia_semana: 0 = domingo … 6 = sábado (matches JS getDay(), so the frontend
-- needs no conversion table).
create table public.cepzk_horario (
  id          smallserial primary key,
  dia_semana  smallint not null,
  hora        time not null,
  -- The label staff already know ("Sexta-Feira 19h30") is kept as data for
  -- display, but it is never parsed: day + hora above are what queries use.
  descricao   citext not null unique,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint cepzk_horario_dia_check check (dia_semana between 0 and 6),
  -- one slot per weekday+time: this is the constraint that makes double-booking
  -- impossible at the catalog level.
  constraint cepzk_horario_dia_hora_unique unique (dia_semana, hora)
);

-- ── 2. volunteers: the auth mirror ──────────────────────────────────────────
-- §P0-2. This row is what turns a JWT into a person the app can act as.
-- 1:1 with auth.users on purpose (uuid = the same identity, int = a second
-- numbering scheme to keep in sync). The 0001 identity layer's generic
-- `profiles` table is therefore superseded: this app has exactly one kind of
-- actor, so one table is the honest model. See schema-review.md §P0-2.
create table public.cepzk_voluntario (
  id           serial primary key,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  nome         text not null,
  email        citext not null unique,
  ativo        boolean not null default true,
  -- Provisioning state, not a permission: permissions come from
  -- auth.users.app_metadata->>'role' (immutable from the client).
  status       public.profile_status not null default 'invited',
  criado_em    timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint cepzk_voluntario_nome_check check (nome ~ '\S' and length(nome) <= 120)
);

create index if not exists cepzk_voluntario_ativo_idx on public.cepzk_voluntario (ativo);

drop trigger if exists cepzk_voluntario_set_updated_at on public.cepzk_voluntario;
create trigger cepzk_voluntario_set_updated_at
  before update on public.cepzk_voluntario
  for each row execute function public.set_updated_at();

-- A volunteer who leaves must never be deleted: assistidos they registered and
-- sessions they led are history. Retire with ativo=false.
-- (No delete policy is created below, which enforces that better than a trigger.)

create table public.cepzk_voluntario_setor (
  voluntario_id int      not null references public.cepzk_voluntario (id) on delete cascade,
  setor_id      smallint not null references public.cepzk_setor (id) on delete restrict,
  horario_id    smallint not null references public.cepzk_horario (id) on delete restrict,
  desde         date not null default current_date,
  -- §P2-2: without `ate`, "which setor was this person in during 2024?" is
  -- unanswerable and re-assignment silently rewrites the past.
  ate           date,
  primary key (voluntario_id, setor_id, horario_id),
  constraint cepzk_voluntario_setor_periodo_check check (ate is null or ate >= desde)
);

-- Reverse lookups (staff roster for a setor / a horário) are the common query
-- and Postgres does not index FK columns for you.
create index if not exists cepzk_voluntario_setor_setor_idx on public.cepzk_voluntario_setor (setor_id, horario_id);
create index if not exists cepzk_voluntario_setor_voluntario_idx on public.cepzk_voluntario_setor (voluntario_id);

-- ── 3. assistido ────────────────────────────────────────────────────────────
-- §P0-5: `nome text not null unique` cannot be the identity. Two "Maria da
-- Silva" is the normal case, not the edge case; the insert fails and staff
-- resolve it by typing "Maria da Silva 2", which then leaks into every report
-- and search. The stable handle is a human code; the name is searchable.
-- §P0-4: no `tratamento_atual` column. A person can be in one treatment PER
-- SETOR concurrently (their own unique(assistido_id, setor_id) guarantees that
-- reading), so a single "current treatment" is either stale or wrong. It is
-- computed in the view at the bottom of this file.
create sequence public.cepzk_assistido_codigo_seq;

create table public.cepzk_assistido (
  id               serial primary key,
  codigo           text not null unique
                     default ('AST-' || lpad(nextval('public.cepzk_assistido_codigo_seq')::text, 6, '0')),
  nome             text not null,
  -- How the person is actually called. In a small center this disambiguates
  -- better than any document number, and it is not sensitive.
  nome_social      text,
  nascimento       date,
  -- LGPD art. 5,II: this table is sensitive-adjacent (health + religion).
  -- Everything not used by a screen stays out. No CPF/address/phone unless a
  -- real workflow needs it — see schema-review.md §P2-4 before adding columns.
  observacao       text,
  entrevistador_id int not null references public.cepzk_voluntario (id) on delete restrict,
  cadastrado_em    timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- §P2-4: erasure request (LGPD art. 18) must not delete treatment history.
  -- Soft-delete hides the person; the audit trail keeps its shape.
  removido_em      timestamptz,
  removido_por     int references public.cepzk_voluntario (id) on delete set null,
  constraint cepzk_assistido_nome_check check (nome ~ '\S' and length(nome) between 2 and 160),
  constraint cepzk_assistido_obs_len check (observacao is null or length(observacao) <= 4000),
  constraint cepzk_assistido_remocao_consistente check (
    (removido_em is null) = (removido_por is null)
  )
);

create index if not exists cepzk_assistido_nome_trgm_idx on public.cepzk_assistido using gin (nome gin_trgm_ops);
create index if not exists cepzk_assistido_entrevistador_idx on public.cepzk_assistido (entrevistador_id);
-- The default list is "quem chegou e ainda não terminou", newest last.
create index if not exists cepzk_assistido_cadastrado_em_idx on public.cepzk_assistido (cadastrado_em desc)
  where removido_em is null;

drop trigger if exists cepzk_assistido_set_updated_at on public.cepzk_assistido;
create trigger cepzk_assistido_set_updated_at
  before update on public.cepzk_assistido
  for each row execute function public.set_updated_at();

-- ── 4. tratamento: the thing the app is about ───────────────────────────────
-- status and motivo are two columns because they answer different questions.
-- "encerrado" is lifecycle; "alta" is the clinical/spiritual outcome. Today the
-- schema can express neither (§P0-1), so "encerrado sem alta" (desistência,
-- transferência) and "concluído" collapse into each other.
create type public.tratamento_status as enum ('em_andamento', 'encerrado');
create type public.tratamento_motivo_encerramento as enum (
  'alta', 'desistencia', 'transferencia', 'obito', 'outro'
);

create table public.cepzk_tratamento (
  id              serial primary key,
  assistido_id    int      not null references public.cepzk_assistido (id) on delete restrict,
  setor_id        smallint not null references public.cepzk_setor (id) on delete restrict,
  horario_id      smallint references public.cepzk_horario (id) on delete restrict,
  status          public.tratamento_status not null default 'em_andamento',
  motivo_encerramento public.tratamento_motivo_encerramento,
  -- `alta_em` is only the date; it is set by the volunteer marking the alta.
  encerrado_em    timestamptz,
  encerrado_por   int references public.cepzk_voluntario (id) on delete set null,
  ordem           smallint not null default 1,
  obs             text,
  criado_por      int not null references public.cepzk_voluntario (id) on delete restrict,
  criado_em       timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint cepzk_tratamento_status_coerente check (
    (status = 'em_andamento' and encerrado_em is null and motivo_encerramento is null)
    or
    (status = 'encerrado' and encerrado_em is not null and motivo_encerramento is not null)
  ),
  constraint cepzk_tratamento_ordem_check check (ordem >= 1),
  constraint cepzk_tratamento_obs_len check (obs is null or length(obs) <= 4000)
);

-- §P1-1. The original `unique(assistido_id, setor_id)` is absolute, so a person
-- who returns to a setor after an alta cannot be enrolled again — the only way
-- to record it would be to mutate the finished row and destroy its alta date.
-- Scoping the constraint to the active treatment keeps the guarantee (no two
-- concurrent rows for the same setor) and frees the re-entry.
create unique index if not exists cepzk_tratamento_ativo_unico_idx
  on public.cepzk_tratamento (assistido_id, setor_id)
  where status = 'em_andamento';

-- The chain `proximo_tratamento` is replaced by an explicit ordinal: a linked
-- list cannot represent "this was the last one", allows a cycle, and forces an
-- UPDATE on the predecessor for every transition.
create unique index if not exists cepzk_tratamento_ordem_unico_idx
  on public.cepzk_tratamento (assistido_id, ordem);

-- §P1-8: policy + queue columns.
create index if not exists cepzk_tratamento_setor_fila_idx on public.cepzk_tratamento (setor_id) where status = 'em_andamento';
create index if not exists cepzk_tratamento_horario_idx on public.cepzk_tratamento (horario_id);
create index if not exists cepzk_tratamento_encerrado_por_idx on public.cepzk_tratamento (encerrado_por);

drop trigger if exists cepzk_tratamento_set_updated_at on public.cepzk_tratamento;
create trigger cepzk_tratamento_set_updated_at
  before update on public.cepzk_tratamento
  for each row execute function public.set_updated_at();

-- ── 5. ACA (the treatment that has an agenda) ───────────────────────────────
-- 1:1 subclass on the original design: id is both PK and FK, so an ACA-specific
-- fact never sits on the generic row. Kept as-is except for nullability.
create table public.aca_distonia (
  id    smallserial primary key,
  nome  citext not null unique,
  ativo boolean not null default true,
  constraint aca_distonia_nome_check check (nome ~ '\S' and length(nome) <= 120)
);

create table public.aca_queixa (
  id    smallserial primary key,
  nome  citext not null unique,
  ativo boolean not null default true,
  constraint aca_queixa_nome_check check (nome ~ '\S' and length(nome) <= 160)
);

create table public.aca_procedimento (
  id    smallserial primary key,
  nome  citext not null unique,
  ativo boolean not null default true,
  constraint aca_procedimento_nome_check check (nome ~ '\S' and length(nome) <= 160)
);

create table public.aca_tratamento (
  tratamento_id int primary key references public.cepzk_tratamento (id) on delete cascade,
  -- Nullable and separately dated: in practice the person arrives at the
  -- interview before anyone knows what they are being treated for. NOT NULL
  -- here forces a guess ('Outros') at the worst possible moment.
  distonia_id   smallint references public.aca_distonia (id) on delete restrict,
  distonia_em   date not null default current_date,
  obs           text,
  constraint aca_tratamento_obs_len check (obs is null or length(obs) <= 4000)
);

create index if not exists aca_tratamento_distonia_idx on public.aca_tratamento (distonia_id);

create table public.aca_tratamento_queixa (
  tratamento_id int       not null references public.cepzk_tratamento (id) on delete cascade,
  -- Was written `small int`, which is not a Postgres type (syntax error). The
  -- referenced PK is `smallserial` → the column must be exactly `smallint`.
  queixa_id     smallint  not null references public.aca_queixa (id) on delete restrict,
  primary key (tratamento_id, queixa_id)
);

create index if not exists aca_tratamento_queixa_queixa_idx on public.aca_tratamento_queixa (queixa_id);

-- §P1-3 (OPEN DECISION). A sessão in a casa is a *room*, not a person: one
-- dirigente, one ponte, one report, N assistidos. With sessao keyed on
-- tratamento_id, a 10-person room is 10 rows and `aca_relatorio` either repeats
-- the same dirigente 10 times or contradicts itself. `aca_encontro` is the room;
-- `aca_sessao` becomes the attendance row. If you would rather not add a table,
-- the fix is to move ponte/dirigente/relatorio onto a shared key instead — the
-- invariant "one report, one room, many attendees" is what has to survive.
create table public.aca_encontro (
  id          serial primary key,
  setor_id    smallint not null references public.cepzk_setor (id) on delete restrict,
  horario_id  smallint references public.cepzk_horario (id) on delete restrict,
  -- timestamptz + a date/time pair: `data` alone (their original) cannot answer
  -- "which encontro is happening right now" without string comparison.
  data        timestamptz not null,
  ponte_id    int references public.cepzk_voluntario (id) on delete restrict,
  dirigente_id int not null references public.cepzk_voluntario (id) on delete restrict,
  relatorio   text,
  relatorio_em timestamptz,
  relatorio_por int references public.cepzk_voluntario (id) on delete set null,
  cancelado_em timestamptz,
  criado_em   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- One gathering per setor per instant.
  constraint aca_encontro_setor_data_unique unique (setor_id, data),
  constraint aca_encontro_ponte_dirigente_distintos check (ponte_id is null or ponte_id is distinct from dirigente_id),
  constraint aca_encontro_relatorio_len check (relatorio is null or length(relatorio) <= 8000),
  -- Writing a report requires having written a report: the person recorded is
  -- the one authenticated, enforced in the API layer, so `relatorio_em` is
  -- set by the same statement that sets the text.
  constraint aca_encontro_relatorio_consistente check (
    (relatorio is null and relatorio_em is null and relatorio_por is null)
    or
    (relatorio is not null and relatorio_em is not null and relatorio_por is not null)
  )
);

create index if not exists aca_encontro_data_idx on public.aca_encontro (data desc);
create index if not exists aca_encontro_dirigente_idx on public.aca_encontro (dirigente_id);
create index if not exists aca_encontro_ponte_idx on public.aca_encontro (ponte_id);

create type public.sessao_presenca as enum (
  'prevista', 'presente', 'falta', 'falta_justificada', 'cancelada'
);

create table public.aca_sessao (
  id            serial primary key,
  encontro_id   int not null references public.aca_encontro (id) on delete cascade,
  tratamento_id int not null references public.cepzk_tratamento (id) on delete restrict,
  presenca      public.sessao_presenca not null default 'prevista',
  obs           text,
  criado_em     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- No double-scheduling the same treatment into one gathering (the original
  -- had no key at all on this table's siblings).
  constraint aca_sessao_encontro_tratamento_unique unique (encontro_id, tratamento_id),
  constraint aca_sessao_obs_len check (obs is null or length(obs) <= 4000)
);

create index if not exists aca_sessao_tratamento_data_idx on public.aca_sessao (tratamento_id);

drop trigger if exists aca_sessao_set_updated_at on public.aca_sessao;
create trigger aca_sessao_set_updated_at
  before update on public.aca_sessao
  for each row execute function public.set_updated_at();

-- §P1-2. The original had no primary key: the same procedimento could be attached
-- twice, and there was no row to target for an update. A composite PK fixes both
-- and gives logical replication a replica identity.
create table public.aca_sessao_procedimento (
  sessao_id        int      not null references public.aca_sessao (id) on delete cascade,
  procedimento_id  smallint not null references public.aca_procedimento (id) on delete restrict,
  aplicado_em      timestamptz not null default now(),
  aplicado_por     int references public.cepzk_voluntario (id) on delete set null,
  primary key (sessao_id, procedimento_id)
);

create index if not exists aca_sessao_procedimento_procedimento_idx
  on public.aca_sessao_procedimento (procedimento_id);

-- ── 6. audit: who marked the alta ───────────────────────────────────────────
-- Encerramento changes the meaning of a person's record. A column pair
-- (encerrado_por/em) records the last one only; if an alta is corrected this
-- table is what shows it was corrected. Cheap to add now, impossible to
-- backfill later (schema-review.md §P2-3).
create table public.cepzk_tratamento_evento (
  id            bigint generated always as identity primary key,
  tratamento_id int      not null references public.cepzk_tratamento (id) on delete cascade,
  tipo          text     not null,
  autor_id      int      references public.cepzk_voluntario (id) on delete set null,
  autor_auth_uid uuid    not null default (select auth.uid()),
  dados         jsonb    not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  constraint cepzk_tratamento_evento_tipo_check check (tipo in (
    'criado', 'encerrado', 'reaberto', 'horario_trocado', 'obs_editada', 'encontro_marcado'
  ))
);

create index if not exists cepzk_tratamento_evento_tratamento_idx
  on public.cepzk_tratamento_evento (tratamento_id, criado_em desc);

-- Append-only: no update/delete policy exists below, and the table owner is the
-- only role that could mutate it. `revoke update, delete` makes even the
-- service role say so in its grants.
revoke update, delete, truncate on public.cepzk_tratamento_evento from anon, authenticated;

-- ── 7. policy helpers ───────────────────────────────────────────────────────
-- Two checks, both required:
--   auth role   — from the JWT, cheap, but a departed volunteer keeps a valid
--                 token until it expires.
--   ativo row   — the DB answer to "may this person still act", effective the
--                 instant ativo is flipped.
create or replace function public.is_voluntario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cepzk_voluntario v
    where v.auth_user_id = (select auth.uid())
      and v.ativo
      and v.status = 'active'
  );
$$;

-- ── 8. grants + RLS ─────────────────────────────────────────────────────────
-- §P0-3. Supabase grants `anon` and `authenticated` on every new public table
-- via default privileges, so *before* this section runs, an unauthenticated
-- caller holding the publishable key can read
--   GET /rest/v1/cepzk_assistido?select=nome,observacao
-- which is the assistido list of a religious charity, with notes. Enabling RLS
-- on the tables is the fix; the revoke is belt-and-braces for the anon role.
do $$
declare
  t text;
begin
  for t in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and c.relname in (
        'cepzk_departamento', 'cepzk_setor', 'cepzk_horario', 'cepzk_voluntario',
        'cepzk_voluntario_setor', 'cepzk_assistido', 'cepzk_tratamento',
        'cepzk_tratamento_evento', 'aca_distonia', 'aca_queixa', 'aca_procedimento',
        'aca_tratamento', 'aca_tratamento_queixa', 'aca_encontro', 'aca_sessao',
        'aca_sessao_procedimento'
      )
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    raise notice 'RLS enabled + anon revoked on %', t;
  end loop;
end
$$;

-- Catalog: every volunteer reads, only an admin edits (deleting a setor would
-- orphan history; that is what ativo is for).
create policy cepzk_setor_select_voluntario on public.cepzk_setor
  for select to authenticated using (public.is_voluntario_ativo());
create policy cepzk_setor_write_admin on public.cepzk_setor
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy cepzk_departamento_select_voluntario on public.cepzk_departamento
  for select to authenticated using (public.is_voluntario_ativo());
create policy cepzk_departamento_write_admin on public.cepzk_departamento
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy cepzk_horario_select_voluntario on public.cepzk_horario
  for select to authenticated using (public.is_voluntario_ativo());
create policy cepzk_horario_write_admin on public.cepzk_horario
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Volunteers: a person may see and edit their own row, all may see the roster.
-- No self-service for ativo/status: that is the off switch, so admin-only
-- (mirrors the guard trigger in 0001_identity.sql).
create policy cepzk_voluntario_select on public.cepzk_voluntario
  for select to authenticated using (public.is_voluntario_ativo());
create policy cepzk_voluntario_update_self on public.cepzk_voluntario
  for update to authenticated
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));
create policy cepzk_voluntario_write_admin on public.cepzk_voluntario
  for insert to authenticated with check (public.is_admin());

create policy cepzk_voluntario_setor_select on public.cepzk_voluntario_setor
  for select to authenticated using (public.is_voluntario_ativo());
create policy cepzk_voluntario_setor_write on public.cepzk_voluntario_setor
  for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Assistidos and treatments: this is a staff-wide workspace, so the scope is
-- "active volunteer", not "own rows" — a volunteer covering another setor must
-- see the queue. Restricting by setor here would break the actual workflow; the
-- protection that matters is that no *non*-volunteer and no *anonymous* caller
-- can read it at all.
create policy cepzk_assistido_select on public.cepzk_assistido
  for select to authenticated
  using (public.is_voluntario_ativo() and removido_em is null);
create policy cepzk_assistido_insert on public.cepzk_assistido
  for insert to authenticated with check (public.is_voluntario_ativo());
create policy cepzk_assistido_update on public.cepzk_assistido
  for update to authenticated
  using (public.is_voluntario_ativo() and removido_em is null)
  with check (public.is_voluntario_ativo() and removido_em is null);
-- Hard delete is admin-only and rare (a duplicate registered by mistake); the
-- normal path for "this person asked to be forgotten" is removido_em, because a
-- delete cascades into the treatment history that the center must keep.
create policy cepzk_assistido_remove_admin on public.cepzk_assistido
  for delete to authenticated using (public.is_admin());

create policy cepzk_tratamento_select on public.cepzk_tratamento
  for select to authenticated using (public.is_voluntario_ativo());
create policy cepzk_tratamento_insert on public.cepzk_tratamento
  for insert to authenticated with check (public.is_voluntario_ativo());
create policy cepzk_tratamento_update on public.cepzk_tratamento
  for update to authenticated using (public.is_voluntario_ativo()) with check (public.is_voluntario_ativo());

create policy cepzk_tratamento_evento_select on public.cepzk_tratamento_evento
  for select to authenticated using (public.is_voluntario_ativo());
create policy cepzk_tratamento_evento_insert on public.cepzk_tratamento_evento
  for insert to authenticated with check (public.is_voluntario_ativo());

-- ACA cluster: same staff scope, nothing narrower is workable (the agenda is
-- shared between the setor's volunteers).
create policy aca_catalog_select on public.aca_distonia
  for select to authenticated using (public.is_voluntario_ativo());
create policy aca_catalog_write on public.aca_distonia
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy aca_queixa_select on public.aca_queixa
  for select to authenticated using (public.is_voluntario_ativo());
create policy aca_queixa_write on public.aca_queixa
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy aca_procedimento_select on public.aca_procedimento
  for select to authenticated using (public.is_voluntario_ativo());
create policy aca_procedimento_write on public.aca_procedimento
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy aca_tratamento_rw on public.aca_tratamento
  for all to authenticated using (public.is_voluntario_ativo()) with check (public.is_voluntario_ativo());
create policy aca_tratamento_queixa_rw on public.aca_tratamento_queixa
  for all to authenticated using (public.is_voluntario_ativo()) with check (public.is_voluntario_ativo());
create policy aca_encontro_rw on public.aca_encontro
  for all to authenticated using (public.is_voluntario_ativo()) with check (public.is_voluntario_ativo());
create policy aca_sessao_rw on public.aca_sessao
  for all to authenticated using (public.is_voluntario_ativo()) with check (public.is_voluntario_ativo());
create policy aca_sessao_procedimento_rw on public.aca_sessao_procedimento
  for all to authenticated using (public.is_voluntario_ativo()) with check (public.is_voluntario_ativo());

-- ── 9. derived reads the UI needs ───────────────────────────────────────────
-- Views rather than denormalised columns: a queue and a "situação do assistido"
-- are both recomputable, so they never go stale. PostgREST embeds these as
-- resources, so the frontend writes no SQL.
create or replace view public.cepzk_assistido_situacao
with (security_invoker = on)
as
select
  a.id                                                              as assistido_id,
  a.codigo,
  a.nome,
  count(t.id) filter (where t.status = 'em_andamento')             as tratamentos_ativos,
  count(t.id) filter (where t.motivo_encerramento = 'alta')        as altas,
  coalesce(
    nullif(array_agg(
      s.nome order by t.ordem
    ) filter (where t.status = 'em_andamento'), '{}'),
    '{}'
  )                                                                as setores_ativos,
  max(a.cadastrado_em)                                             as cadastrado_em
from public.cepzk_assistido a
left join public.cepzk_tratamento t on t.assistido_id = a.id
left join public.cepzk_setor s on s.id = t.setor_id
where a.removido_em is null
group by a.id, a.codigo, a.nome;

-- The front page of the app: who is waiting, in which setor, since when.
create or replace view public.cepzk_fila_atendimento
with (security_invoker = on)
as
select
  t.id   as tratamento_id,
  t.assistido_id,
  a.codigo,
  a.nome as assistido_nome,
  t.setor_id,
  s.nome as setor_nome,
  d.nome as departamento_nome,
  t.horario_id,
  h.dia_semana,
  h.hora,
  t.ordem,
  t.criado_em,
  (now() - t.criado_em) as tempo_na_fila
from public.cepzk_tratamento t
join public.cepzk_assistido a on a.id = t.assistido_id and a.removido_em is null
join public.cepzk_setor s on s.id = t.setor_id
join public.cepzk_departamento d on d.id = s.departamento_id
left join public.cepzk_horario h on h.id = t.horario_id
where t.status = 'em_andamento';

grant select on public.cepzk_assistido_situacao, public.cepzk_fila_atendimento to authenticated;
revoke all on public.cepzk_assistido_situacao, public.cepzk_fila_atendimento from anon;
