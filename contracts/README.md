# Contract — `cepzk_atendimentos_web` ⇄ `cepzk_atendimentos_backend`

This directory is the **interface** between the two repos. It is owned by the web repo and
reviewed like code. Nothing here runs — it is the specification the Supabase project is built
to, plus the types the frontend compiles against.

## 1. Division of responsibility

| Area                                                                      | Repo                                    | Notes                                                                           |
| ------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| Next.js app, Vercel deploy, UI state                                      | `cepzk_atendimentos_web`                | Next 16, React 19, Tailwind 4                                                   |
| Supabase project, migrations, RLS, Edge Functions, `supabase/config.toml` | `cepzk_atendimentos_backend`            | Applied via `supabase db push` / CI                                             |
| **This schema + API shape**                                               | **`cepzk_atendimentos_web/contracts/`** | Both sides implement it; drift is a bug                                         |
| `service_role` key, `DATABASE_URL`                                        | `cepzk_atendimentos_backend` only       | Never in the Vercel project — `src/lib/env/server.ts` refuses to boot otherwise |

**Change protocol.** Schema changes are proposed here (PR against this repo), merged, and only then
applied in the backend repo. The reverse order means the frontend is broken until someone regenerates
types. If you are the backend agent and you need a column we did not specify: edit `contracts/sql/`
and `contracts/types/database.types.ts` in the same commit as the migration, and keep both in sync.

## 2. Files

| Path                          | Owner                    | Consumed by                                                    |
| ----------------------------- | ------------------------ | -------------------------------------------------------------- |
| `auth.md`                     | web                      | both — magic-link config, claims shape, roles, provisioning    |
| `rls-conventions.md`          | web                      | backend — policy naming, anti-pattern list                     |
| `edge-functions.md`           | web                      | both — function names, envelope, error codes                   |
| `env-matrix.md`               | web                      | both — every variable, where it may live                       |
| `supabase-project-setup.md`   | web                      | human/BE agent — exact dashboard settings                      |
| `sql/*.sql`                   | web                      | backend — paste into `supabase/migrations/000x_*.sql` verbatim |
| `types/database.types.ts`     | web                      | FE imports it via `@contracts/types/database.types`            |
| `types/database.generated.ts` | `npm run types:generate` | drift check only; machine-owned                                |

Contract hash (pin it at the top of your first migration so we can tell apart "implemented" from
"implemented and then quietly edited"):

```bash
npm run contract:hash -- --write   # → contracts/CONTRACT.sha256
```

`CONTRACT.sha256` is committed; copy its value into the first line of your migration. Prose edits do not
change it (only `sql/*.sql` + `types/*.ts` are hashed), so the hash stays a real signal.

## 3. Domain — PENDING

The domain model is **not specified yet**; `sql/0002_domain.pending.sql` is a stub. The frozen part
(identity: profiles, roles, RLS helpers) is fully specified and can be migrated today.

Everything the frontend needs to know about the domain, in the order it blocks work:

1. **What an "atendimento" is.** A row that represents what, exactly — a support conversation, a
   booked appointment, a service job, a case? Its lifecycle is the whole app, so this decides the
   state machine.
2. **Statuses** — names and allowed transitions (`draft → open → waiting_client → resolved → closed`?).
   These become a Postgres enum; renaming one later is a migration in two repos.
3. **Actors** — who creates an atendimento and who works it. `staff`, `client`, or both? Is an
   atendimento assignable, and can it have more than one assignee?
4. **Channel** — is a WhatsApp/email conversation attached to each atendimento (so we need
   `mensagens` + inbound webhook), or is the body just free-text notes?
5. **Client identity** — are the people being served Supabase users (RLS per row, login for them) or
   plain rows (no login, staff-only app)? This is the single biggest schema fork.
6. **Tenancy** — one org, or many orgs/branches (needs `organization_id` on every table + a JWT claim)?
7. **Numbers** — do atendimentos get a human code (`ATD-000123`)? Auto-generated via sequence, and
   the frontend will display it everywhere.
8. **Search/sort** — what filters does the queue need? Decides which indexes and GIN trigram ops exist.

Fill this in by editing the table below, or answer in chat and the web agent will write it:

```yaml
domain:
  entity: # e.g. atendimento = scheduled service appointment
  statuses: []
  transitions: {}
  actors: []
  channel: none | messages_thread
  client_can_login: true | false
  tenancy: single_org | multi_org
  human_code: true | false
```

## 4. How the two repos stay honest

- The frontend's Supabase client is generic over `Database`
  (`createServerClient<Database>`), so a rename on the backend is a **type error**, not a blank
  screen.
- `npm run types:generate` pulls the real types from the provisioned project and prints a table-level
  drift report; it exits non-zero when `contracts/` and the live DB disagree.
- `npm run types:generate` is the gate: it exits **2** on drift, so `.github/workflows/ci.yml` runs it
  whenever `SUPABASE_ACCESS_TOKEN` is configured and `contracts/types/database.generated.ts`
  (gitignored, machine-owned) is regenerated locally or by the backend's pipeline as an artifact.
- Reads that need joins across RLS boundaries go through a view or an Edge Function — never by
  handing the frontend the service key.
