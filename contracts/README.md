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

## 3. Domain — received, reviewed, reconciled

The owner's schema (15 tables, `cepzk_*` + `aca_*`) is in git history as the input; the review of it is
**[`schema-review.md`](schema-review.md)** and the reconciled migration is
**[`sql/0002_domain.sql`](sql/0002_domain.sql)**. Read those two before touching either.

Locked decisions:

| Topic              | Decision                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Domain             | `assistido` registered after the _Atendimento Fraterno_ interview; enrolled in N `tratamento`s (one per `setor`); each ends in **`alta`** |
| `client_can_login` | **No** — `assistido` rows are not users, so there is exactly one actor class and no per-row client scope                                  |
| Tenancy            | **Single org**                                                                                                                            |
| Sessions           | Only setores with `tem_agenda` get one (ACA today); `presenca` tracked                                                                    |
| Realtime           | Not in v1 (refetch on focus)                                                                                                              |

Still open — three questions, all listed with recommendations in `schema-review.md` §"Decisions needed":
**the `aca_encontro` split (P1-3)**, **whether the AF interview is a `tratamento` row (P2)**, and
**whether faltas feed back into `status`**.

Highest-severity items, in short: `alta` had no column (P0-1), volunteers had no `auth.users` link so no
policy could be written (P0-2), RLS was absent on sensitive data (P0-3), `tratamento_atual` contradicted
`unique(assistido_id, setor_id)` (P0-4), and `nome unique` was the identity key (P0-5).

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
