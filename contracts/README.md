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

## 3. Domain — casa espírita: atendimentos & tratamentos

Answered (locked):

| #   | Question                    | Decision                                                                                                                                                                                  |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Can the `assistido` log in? | **No.** They are plain rows, no `auth.users`. The app is volunteers-only, so `authenticated` is the only role that needs read access and the "client scope" class of policies disappears. |
| 6   | Tenancy                     | **Single org.** No `organization_id` anywhere.                                                                                                                                            |
| —   | Self-signup                 | Off; volunteers are provisioned by an admin.                                                                                                                                              |

Stated by the domain owner (my reading — correct me if the grain is wrong):

1. `assistido` — a person receiving assistance. Registered **after** the _Atendimento Fraterno_
   interview, by the volunteer who interviewed them.
2. `tratamento` — a catalog of treatment types the center offers.
3. `atendimento` ≈ **one assistido enrolled in one tratamento** — not "the interview" and not
   "one visit". Its lifecycle ends in **`alta`** (discharge), marked by a volunteer.
4. Sessions: for one specific tratamento type, volunteers maintain an **agenda de sessões** per
   assistido (recurring appointments, attendance presumably relevant). Specified separately later.

Derived from that, the shape the frontend expects (pending your DDL, see §3.5):

```
assistidos ──< atendimentos >── tratamentos
                    │  status: em_andamento → concluido(alta)
                    └──< sessoes (only for the treatment type that has an agenda)
```

Consequences already visible:

- `assistidos` are **third-party personal data in a charity context** (and religion-adjacent). That is
  an LGPD minimisation question, not a nice-to-have: no columns nobody uses, hard-delete vs `deleted_at`
  must be an explicit decision, and "who changed the alta" wants an audit trail from day 1 — retrofitting
  `atendimento_eventos` later loses history.
- `alta` as **status vs timestamp** matters: `status = 'concluido'` alone cannot answer "how long was the
  average treatment", and a `alta_em` timestamp without a status breaks the queue filter. Prefer both.
- A person can be in several treatments at once, so "is this assistido done?" is _not_ a field on
  `assistidos` — never denormalise it there.

### 3.5 Blocking on your DDL

You have an existing schema. Paste/point me at it (any of: `supabase/migrations/*.sql`,
`pg_dump --schema-only`, or the dashboard's SQL editor export) and I will do the drift work instead of
guessing: reconcile `contracts/sql/` + `contracts/types/database.types.ts` to match, then flag anything
that is load-bearing and missing — absent `RLS ENABLE`, no index on a policy column, statuses as free
`text` instead of an enum, `timestamp` instead of `timestamptz`, a hard `FK ... on delete cascade` that
would erase an alta history, or the service key in the web project.

Four things a DDL dump cannot tell me, so answer in prose:

1. **Grain of `atendimento`** — is one row "the enrollment in one treatment" (my reading) or "one
   visit/meeting"?
2. **Status vocabulary + who may move it** — exact values, and is `alta` reversible by a staff volunteer
   or admin-only?
3. **Sessions** — does the agenda belong to _one_ treatment type (a column on `tratamentos` like
   `has_agenda`) or is any treatment able to have sessions? Are sessions shared (several assistidos per
   sessão, capacity limit) or one-to-one? Is attendance (`presente`/`falta`/`justificada`) recorded, and
   is a `falta` supposed to nudge the status back?
4. **Volumes + outputs** — rough count of assistidos and sessões/week, and whether a printed
   "relação de sala" / CSV export is a requirement (it changes pagination and query shape, not just the UI).

Fill in this block (or answer in chat and the web agent writes it):

```yaml
domain:
  entity: atendimento = assistido enrolled in one tratamento, ends in alta
  statuses: [] # exact values, e.g. [em_andamento, concluido]
  transitions: {} # who may move each edge
  actors: [volunteer, admin]
  channel: none
  client_can_login: false
  tenancy: single_org
  human_code: false # TBD — codes like ATF-000123 are useful for phone lookups
  sessions: TBD # see §3.5 (3)
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
