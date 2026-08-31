# Schema review — `cepzk_*` / `aca_*`

Reviewed: the DDL you pasted (15 tables). Reconciled result: [`sql/0002_domain.sql`](sql/0002_domain.sql).

Read with one caveat: what you pasted is shorthand (`fk(...)`, no `constraint` names, `small int`), so it is
a design sketch rather than the applied migration. P0-3 and P1-7 may already be handled in a file I have
not seen — treat those two as a checklist to confirm, the rest are about the model itself and stand either
way.
Every finding below carries the fix's location in that file, so you can apply the subset you agree with.

Numbers are stable — quote `P0-3` in a PR and we both know which thing is meant.

## Verdict

The catalog design is good and I changed almost none of it. Three things block the app from existing,
though, and one of them is an exposure rather than a design preference:

| #    | Finding                                                                                                                        | Severity               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| P0-1 | `alta` has no column anywhere — the event the app exists to record cannot be stored                                            | blocker                |
| P0-2 | `cepzk_voluntario` has no link to `auth.users` — RLS is unwritable, and `entrevistador_id` must be client-supplied (forgeable) | blocker                |
| P0-3 | No `RLS ENABLE` and no `revoke` — with Supabase defaults the publishable key reads every assistido anonymously                 | **security**           |
| P0-4 | `assistido.tratamento_atual` (one int) contradicts `unique(assistido_id, setor_id)` (many concurrent)                          | blocker                |
| P0-5 | `nome text not null unique` as a person's identity                                                                             | blocker (data quality) |

### What is right, and kept

- **Lookup tables over enums** for `distonia`, `queixa`, `procedimento`, `setor`, `departamento`. Volunteers
  can be given a screen to add a row; an enum needs a migration. Correct instinct for this domain.
- **`aca_tratamento.id` as PK _and_ FK** — textbook 1:1 subclass; ACA facts never leak onto the generic
  treatment. Unchanged.
- **`unique(assistido_id, setor_id)`** — someone thought about duplicates. It needs a `where` clause (P1-1),
  but the intent is preserved rather than dropped.
- **`aca_sessao.data` as `timestamptz`** — the only `timestamptz` in the schema, and the right one.
- **`cepzk_voluntario_setor` with a 3-column PK** — correct shape; it just has no time dimension (P2-2).

## P0-1 — the `alta` lifecycle is missing entirely

Your description: _"quando o assistido receber alta, um voluntário marca tratamento em questão como
completo"_. There is no column that can hold that. The only proxies are `assistido.tratamento_atual` moving
onward and `tratamento.proximo_tratamento` pointing at a successor, which produces four concrete failures:

1. **The last treatment in a chain can never be marked complete** — nothing points at a next one, so the
   final (most common!) alta is inexpressible.
2. **No `alta` date**, so "duração média do tratamento", "quantos aguardam há mais de 6 meses" and any
   annual report the diretoria asks for are unanswerable from data.
3. **"Encerrado sem alta" is invisible.** Desistência, transferência and óbito are all `encerrado` with a
   different _reason_, and collapsing them into "concluído" is how a center reports success it didn't have.
4. **`tratamento_atual IS NULL` means three different things**: not yet started, finished everything, or
   removed. One column, three readings.

Fix (`0002_domain.sql` §4): `status public.tratamento_status ('em_andamento','encerrado')` +
`motivo_encerramento ('alta','desistencia','transferencia','obito','outro')` + `encerrado_em` +
`encerrado_por`, tied together by one `check` constraint so `encerrado` without a reason/date cannot be
written. Note `alta_em` deliberately does **not** exist as a separate column — `encerrado_em` when
`motivo = 'alta'` is the same fact once, not twice.

## P0-2 — no volunteer ↔ auth user link

`cepzk_voluntario (id serial, nome text)` — nothing connects a row to a logged-in identity. Consequences,
in escalating order:

- **No policy can be written.** "Is the caller an active volunteer?" has no SQL to answer it.
- **`entrevistador_id` has to come from the browser.** The client would POST "I am volunteer 7", and any
  authenticated user can send any integer: the registration audit trail becomes fiction. Same for
  `ponte_id`/`dirigente_id` and whoever marks an alta.
- **The "who am I" query** every screen needs is impossible.

Fix (§2): `auth_user_id uuid not null unique references auth.users (id) on delete cascade` +
`is_voluntario_ativo()` (§7). Two checks, both needed: the JWT role is cheap but a departed volunteer keeps
a valid token until it expires; the `ativo` row is the instant off-switch. This also means every write that
records a person derives it from `auth.uid()` in the API layer — the frontend never sends an id.

**This changes my own contract.** `0001_identity.sql` created a generic `public.profiles`; with
`cepzk_voluntario` present that table is a second mirror of the same person with a second name and a
second set of policies. `cepzk_voluntario` wins (it carries `nome` the center actually uses and the setor
assignments), so `profiles` should be dropped and 0001 reduced to the enum + helper functions. Say the word
and I'll fold it — I have not edited 0001 unilaterally because it was already handed to the BE agent with a
pinned hash.

## P0-3 — no RLS, and this is sensitive data

The DDL has no `enable row level security` and no `revoke`. Supabase's default privileges grant `anon` and
`authenticated` on every new table in `public`, so as designed today, before any policy exists:

```
GET https://<ref>.supabase.co/rest/v1/cepzk_assistido?select=nome,observacao
  apikey: <publishable key — it is public by definition>
```

returns the list of people a charitable religious organization assists, with free-text notes. Not a
hypothetical: the publishable key ships in the browser bundle, and PostgREST is reachable from anywhere.
That is `dados sensíveis` under LGPD art. 5,II (saúde — `distonia`, `queixa`, `convulsão` — and crença
religiosa in the same row).

Fix: §8 enables RLS on all 16 tables via a catalog loop (so a 17th table cannot silently skip it), revokes
`anon` everywhere, and writes one policy set per access pattern. Two details worth keeping even if you
rewrite the rest:

- The `do $$ ... $$` loop is over an explicit table list — not `relkind='r'` across all of `public` — so a
  future internal table is a visible diff in review, not an invisible auto-grant.
- `cepzk_tratamento_evento` gets `revoke update, delete, truncate`: an audit table that can be edited is a
  liability, not a control.

## P0-4 — `tratamento_atual` contradicts your own unique constraint

`unique(assistido_id, setor_id)` means a person may hold **one active treatment per setor** — so they can be
in Atendimento Fraterno and Fluidoterapia in the same week. `cepzk_assistido.tratamento_atual int` can name
only one, will go stale the moment a second exists, and has no rule for which one wins.

Fix: drop the column; compute it. `cepzk_assistido_situacao` (§9) exposes `tratamentos_ativos`, `altas` and
`setores_ativos`, and `cepzk_fila_atendimento` is the queue. Views rather than a trigger-maintained column
because they cannot drift, and PostgREST embeds both as resources so the frontend writes no SQL.

## P0-5 — a unique name is not an identity

`nome text not null unique` on `cepzk_assistido`. In Brazil "Maria da Silva" colliding is the normal case.
The failure mode is not an error message, it's staff typing **"Maria da Silva 2"** to make the insert
succeed — and that string then propagates into every relatório and search, and is what a volunteer reads
aloud in the sala.

Fix (§3): `codigo text not null unique default 'AST-' || lpad(nextval(...))` as the stable handle (works on
the phone, survives a name correction), `nome` non-unique with a GIN `gin_trgm_ops` index for the search
box, `nome_social` for what people actually call them, and a `check (nome ~ '\S')` so an all-whitespace
name never satisfies the constraint.

If uniqueness was there for a real reason — deduplicating a person re-registered by two volunteers — say so
and I'll build that as an explicit "possible duplicate" prompt at registration time instead of a DB
constraint that fails the second legitimate person.

## P1 — correctness and cost

| #    | Finding                                                                                                                                                                                                                                                                                                                              | Fix                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1 | `unique(assistido_id, setor_id)` is absolute, so **a return visit to the same setor cannot be recorded** without mutating the finished row and destroying its alta. Compounded by `proximo_tratamento`: a linked list has no "last", permits a cycle, and needs an UPDATE on the predecessor for every transition.                   | Partial unique `where status = 'em_andamento'` + `ordem smallint` with `unique(assistido_id, ordem)`; chain deleted.                                                                |
| P1-2 | `aca_sessao_procedimento` has **no primary key**: same procedimento attachable twice, no row to target on update, no replica identity.                                                                                                                                                                                               | `primary key (sessao_id, procedimento_id)` + index on `procedimento_id`.                                                                                                            |
| P1-3 | **A room is modelled as N people.** `aca_sessao(tratamento_id, data)` → a 10-person sessão is 10 rows, and `aca_relatorio(ponte_id, dirigente_id)` repeats or contradicts the same room facts with nothing enforcing agreement.                                                                                                      | `aca_encontro` (room: data, setor, ponte, dirigente, relatório) + `aca_sessao` (attendance: encontro_id, tratamento_id, presenca). **Open decision — see below.**                   |
| P1-4 | `cepzk_horario.nome` is the whole row ("Sexta-Feira 19h" / "…19h30" are two unparseable strings). No conflict detection, alphabetical sort, and typo-duplicates accumulate in a table staff edit.                                                                                                                                    | `dia_semana smallint check 0..6` + `hora time` + `unique(dia_semana, hora)`, keeping `descricao` for the label. 0=Sunday matches JS `getDay()` so the frontend needs no conversion. |
| P1-5 | **No `created_at` anywhere.** "Quem espera há mais tempo" (the queue's entire premise) is unanswerable; no retention anchor either.                                                                                                                                                                                                  | `criado_em` on every table + one shared `set_updated_at()` trigger.                                                                                                                 |
| P1-6 | No `on delete` on any FK. Default `NO ACTION` is safe, but "fix that error" pressure ends in `on delete cascade` from `cepzk_assistido`, which erases history.                                                                                                                                                                       | Explicit everywhere: `restrict` for history-bearing, `cascade` only for pure join tables and the `aca_tratamento` subtype.                                                          |
| P1-7 | **Two statements don't parse**: `queixa_id small int` (`syntax error at or near "int"` — I checked against Postgres' grammar) and a stray `.` in `aca_sessao`. Also `smallserial`→`smallint` vs `serial`→`int` must match exactly at each FK.                                                                                        | Corrected in the DDL; run `npm run sql:lint` on anything you add.                                                                                                                   |
| P1-8 | No index on any FK column except where a unique constraint happens to cover it. Postgres does not index FKs. Every reverse lookup ("tratamentos deste setor", "quem cadastrou este assistido", "voluntários deste horário") is a seqscan, and **a column inside an RLS predicate needs an index or the policy multiplies the scan**. | ~10 index statements (§2–§6), three of them partial on `status`/`removido_em` because the filter is permanent.                                                                      |

## P2 — worth a decision now, cheap to skip later

1. **`obs text` on 4 tables** is where diagnosis language ends up living. Keep it, but bound it
   (`length(obs) <= 4000`) and never let `obs` flow into a URL, an error message, or an analytics event —
   that's how sensitive data escapes a Vercel deployment sideways.
2. **`cepzk_voluntario_setor` has no `desde`/`ate`** — reassigning a volunteer silently rewrites which setor
   they were "in" for all of history. Two date columns.
3. **No audit trail.** `encerrado_por/em` records only the most recent encerramento. `cepzk_tratamento_evento`
   (append-only, revoke update/delete) is ~15 lines now and unrecoverable later.
4. **LGPD.** `removido_em` + `removido_por` give you an erasure path that keeps the history the center needs;
   decide the retention period out loud (a "casa espírita keeps assistido records for N years" answer is
   fine, an undocumented one is not). Minimisation is the lever: every column you don't add needs no policy,
   no breach notification, and no consent conversation.
5. **`citext` on lookup names** (`setor`, `departamento`, `distonia`, `queixa`, `procedimento`) — otherwise
   `"TEA"` and `"tea"` are two rows, and the unique constraint you carefully wrote doesn't notice.
6. **Prefixes vs schemas.** `cepzk_`/`aca_` in one `public` schema works (and PostgREST only serves
   `public` unless you set `db_schemas`), but a third program means a third prefix on every table.
   `aca.*` / `cepzk.*` in separate schemas + `db-schemas = ["public","aca"]` is the version that scales; I
   kept your prefixes to avoid a gratuitous change.
7. **`check (ponte_id is distinct from dirigente_id)`** on the meeting, and `unique` on
   `aca_relatorio` if a sessão truly has one report — otherwise the second one silently wins in the UI.
8. **`int` vs `bigint`.** `serial` is 2.1B, plenty; `alter ... bigint` is free today and painful at row
   2^31. Not urgent.

## Decisions needed from you

**1. Room vs per-person sessions (P1-3).** This is the one I cannot pick for you, and it's the table your
deferred agenda feature sits on.

- **A (recommended): `aca_encontro` + `aca_sessao`.** One gathering = one row with `ponte`, `dirigente`,
  `relatorio`; each assistido is an attendance row with `presenca`. Matches how the sala actually works,
  and "relação de sala" becomes one query instead of a `group by` over 10 contradicting rows.
- **B: keep `aca_sessao` per treatment**, move `ponte`/`dirigente`/`relatorio` onto a new
  `aca_encontro`-ish parent anyway — i.e. A with extra steps.
- **C: keep it exactly as you wrote it**, and accept that `aca_relatorio` needs a dedupe rule you must
  enforce in the Edge Function.

**2. Is the Atendimento Fraterno interview a `tratamento` row in the AF setor?** `cepzk_setor` contains
"Atendimento Fraterno" and `cepzk_assistido.entrevistador_id` exists, which suggests yes — the interview _is_
a treatment that ends in alta. If so, `entrevistador_id` is redundant with `tratamento.criado_por` and I'd
drop it; if not, the interview needs its own table (with `data`, `encaminhadas`, `obs`) because right now
the only trace of it is a foreign key with no date.

**3. Does a `faltas` count feed back into `status`?** (auto-suggest "reavaliar", or never touch it). I put
`presenca` in the DDL with a default of `prevista`, so either answer is a UI rule, not a migration — but if
"N faltas → reavaliar" is real policy, the threshold belongs in a `setor` column, not hard-coded in React.

## Applying it

```bash
# in cepzk_atendimentos_backend, on a branch
supabase migration new identity   # paste contracts/sql/0001_identity.sql (minus public.profiles — see P0-2)
supabase migration new domain     # paste contracts/sql/0002_domain.sql
supabase db reset && supabase test db
```

Then, here:

```bash
SUPABASE_PROJECT_REF=<ref> npm run types:generate   # exits 2 on drift; that's the gate
```

I need the project URL + publishable key in `.env.local` (and as Vercel env vars) to exercise the real
login. The dev server is already running against a placeholder and behaves correctly — `/app` bounces to
`/login?next=%2Fapp`.
