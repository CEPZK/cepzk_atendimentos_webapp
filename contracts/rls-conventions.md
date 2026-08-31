# RLS conventions

Row Level Security is the **only** security boundary between the browser and Postgres: the publishable
key is public, and `/app` is behind a route guard that any `curl` can walk around. Assume every query in
this contract is reachable directly by an unauthenticated attacker.

## 1. Mandatory for every table

```sql
alter table public.<t> enable row level security;

-- then, on tables that NO security-definer helper reads:
alter table public.<t> force row level security;
```

`force` closes the hole where the table owner (and anything running as it) skips policies — but it must be
omitted on any table a `security definer` policy helper reads, or Postgres fails with
`infinite recursion detected in policy for relation`. `profiles` is that exception, because
`is_active_member()` reads it: see the comment in `sql/0001_identity.sql` §8. Decide per table, and say
which you chose in the migration.

Policies are per-privilege and per-command. `using` filters existing rows, `with check` filters written
rows; a write policy with no `with check` lets a user insert a row they then cannot read (or reassign).

## 2. Naming

`<table>_<privilege>_<who>` — e.g. `atendimentos_select_own`, `atendimentos_update_staff`,
`profiles_delete_admin`. Names appear in `pg_policies` output and in incident reviews; "policy_1" does not.

## 3. Performance & correctness rules

| Rule                                                                  | Why                                                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Wrap sub-selects in `(select auth.uid())`                             | Postgres caches the scalar per query instead of re-evaluating per row                            |
| Never call `auth.jwt()` on a large scan without an index backing it   | text JSON extraction per row                                                                     |
| Index every column used in a policy predicate                         | policies become the `WHERE` clause; without an index this is a seq-scan multiplied by the policy |
| `to authenticated`, not `to public`                                   | `public` includes `anon`                                                                         |
| No `security definer` view without `set search_path = ''`             | search_path hijacking                                                                            |
| One table = one `select` policy per role, `or`-joined via a helper fn | 6 overlapping policies read as 6 scans to the planner and to humans                              |
| Truncate/alter by `admin` only                                        | `truncate` bypasses row policies silently                                                        |

Helper functions used by policies are defined in `sql/0001_identity.sql`:

```sql
public.current_app_role()   -- text role from JWT, or null
public.is_staff()           -- role in ('admin','staff')
public.is_admin()           -- role = 'admin'
public.is_active_member()   -- profiles.status = 'active' for auth.uid()
```

`is_active_member()` is a `security definer` function so a disabled user's own profile read cannot
recursively depend on the policy that calls it.

## 4. Patterns

**Ownership (client-facing rows).**

```sql
create policy atendimentos_select_own on public.atendimentos for select to authenticated
  using (
    client_user_id = (select auth.uid())
    or public.is_staff()
  );
```

**Assignment (staff sees their queue + unassigned).**

```sql
create policy atendimentos_select_assigned on public.atendimentos for select to authenticated
  using (
    (public.is_staff() and (assignee_id = (select auth.uid()) or assignee_id is null))
    or public.is_admin()
  );
```

**Privilege columns guarded by trigger, not policy.** Column-level restriction does not exist in RLS, so
`status`, `assignee_id`, `role`, and anything tenant-wide get a trigger that raises unless
`public.is_admin()`/`is_staff()` — see `trg_profiles_guard` in `0001_identity.sql` for the template.

**Writes go through the API, not the browser, when they are multi-step.** A client may `insert` its own
request; only a function may move it to `assigned` and notify. If a mutation needs a transaction, an
idempotency key, or a side effect, it belongs in an Edge Function (`edge-functions.md`).

## 5. Anti-patterns — seen in review, reject on sight

1. `using (true)` "temporarily" on a table the frontend can reach.
2. `admin` role derived from `raw_user_meta_data` (client-writable).
3. Policies that check `auth.role() = 'authenticated'` and nothing else — that's "logged in", not "allowed".
4. Realtime channel on a table whose policy requires a join the anon role cannot make.
5. `grant all on schema public to anon` + "the app doesn't query that table".
6. Service-role client instantiated anywhere in `src/` (there is no such import by design).
7. Storing the raw WhatsApp/email body in a column that a broad policy reads, when a thread table exists.
8. A `select` policy with `with check` and nothing else — that is an `insert` policy wearing a hat.

## 6. Test requirement before merge

Every policy needs a test in the backend repo that (a) signs in as a real second user and (b) proves the
row is **not** visible. `supabase test db` + pgTAP, or `pg_prove`:

```sql
-- both directions, or the test proves nothing
select tests.policy_allows_owner_view();
select tests.policy_blocks_non_owner_view();
```

A one-user test suite passes for every privilege-escalation bug we care about.
