# CEPZK Atendimentos — web

Next.js 16 frontend for the CEPZK service desk. **This repo is only the frontend.** Auth, the database,
and any server-side logic run in a Supabase project that is defined in
[`CEPZK/cepzk_atendimentos_backend`](https://github.com/CEPZK/cepzk_atendimentos_backend).

```
┌──────────────────────────┐        ┌───────────────────────────────────────┐
│  Vercel  (this repo)     │        │  Supabase  (…_backend repo)           │
│                          │        │                                       │
│  Next 16 App Router      │  HTTPS │  Postgres + RLS      ← the boundary   │
│  ├ proxy.ts   refresh    ├───────►│  Edge Functions       ← privileged    │
│  ├ RSC reads (typed)     │        │  Auth (magic link)    ← HttpOnly sess │
│  └ TanStack Query (CSR)  │        │  Storage / Realtime (v2)              │
└──────────────────────────┘        └───────────────────────────────────────┘
            ▲                                        ▲
            └──── contracts/ in THIS repo defines ───┘
                  the schema, the roles, the API envelope
```

`contracts/` is the interface between the two repos and is reviewed like code. Read
[`contracts/README.md`](contracts/README.md) before changing anything the other side consumes.

## Status

| Piece                                                       | State                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| App scaffold (Next 16, TS strict, Tailwind 4, typed routes) | ✅ done                                                |
| Supabase clients (browser / server / proxy)                 | ✅ done, generic over the contract types               |
| Magic-link sign-in, callback, sign-out, route guard         | ✅ done — needs a project to point at                  |
| Security headers, env validation with secret-leak guard     | ✅ done                                                |
| Identity SQL (profiles, roles, RLS helpers)                 | ✅ specified in `contracts/sql/0001_identity.sql`      |
| Domain schema + screens                                     | ⛔ blocked on `contracts/README.md` §3 (the questions) |
| Type-drift CI                                               | ⏸ wired, needs `SUPABASE_PROJECT_REF` to enable        |

## Local development

```bash
cp .env.example .env.local     # fill in the two NEXT_PUBLIC_SUPABASE_* values
npm install
npm run dev                    # http://localhost:3000
```

If `NEXT_PUBLIC_SUPABASE_URL` is unset every page throws the validation message from
`src/lib/env/public.ts` — that is intentional, a mis-configured Vercel project should fail loudly rather
than render a logged-out shell.

Useful scripts:

| Command                  | What it does                                                     |
| ------------------------ | ---------------------------------------------------------------- |
| `npm run check`          | lint → typecheck → build                                         |
| `npm run typecheck`      | `tsc --noEmit` (also typechecks `contracts/**/*.ts`)             |
| `npm run contract:hash`  | hash of the SQL + shared types, to pin in migration headers      |
| `npm run types:generate` | pull live types from Supabase, diff vs contract, exit 2 on drift |
| `npm run contract:check` | diff the last generated snapshot without calling the CLI         |

## Layout

```
src/
  proxy.ts                    Next 16's renamed middleware: refresh + route guard
  lib/
    env/{public,server}.ts    zod-validated env; server.ts refuses privileged secrets
    supabase/{client,server,proxy}.ts   the three clients, typed with Database
    auth/{actions,session}.ts signInWithMagicLink, signOut, getPrincipal, requirePrincipal
    api/invoke.ts             the ONLY place Edge Functions are called
    query/query-client.ts     TanStack Query defaults (no realtime in v1 → refetch on focus)
  app/
    login/                    magic-link screen (public)
    auth/callback/route.ts    code → session exchange (PKCE)
    app/                      signed-in surface, behind requirePrincipal()
contracts/                    → see contracts/README.md
scripts/                      typegen + contract hashing
```

## Deploying on Vercel

1. Import this repo. Framework is auto-detected; Node 22 per `engines`.
2. Add the two `NEXT_PUBLIC_SUPABASE_*` variables (and `NEXT_PUBLIC_ALLOW_SELF_SIGNUP`) to
   _Production_ **and** _Preview_. Do not paste a service-role key anywhere — the build throws if one is
   present.
3. Vercel's preview host is `https://<project>-git-<branch>-<user>.vercel.app`; each deployment gets its
   own origin, which is why `emailRedirectTo` is computed from request headers rather than an env var.
   The Supabase Redirect URL list must include `https://*.vercel.app/auth/callback`.
4. Set the production domain as the Supabase **Site URL** (see `contracts/supabase-project-setup.md`).

## Things deliberately not done yet

- **Domain screens** — waiting on the three answers in `contracts/schema-review.md` §"Decisions needed".
- **`public.profiles`** — superseded by `cepzk_voluntario` (see review P0-2); 0001 should shrink to the enum
  - helpers once that call is confirmed.
- **Realtime** — decided against for v1; `refetchOnWindowFocus: true` covers it, and swapping to a
  `postgres_changes` channel is a change in `src/lib/query/` only.
- **Full CSP** — partial headers ship now; a strict `script-src` needs nonce support
  (`experimental.csp`) or it breaks the inlined flight payload.
- **Server → client cache hydration** for TanStack Query — reads are Server Components for now; add
  `dehydrate/hydrateClient` when a screen needs optimistic writes.
- **Tests** — no runner configured yet; the moment domain queries exist, RLS tests belong in the backend
  repo (`contracts/rls-conventions.md` §6) and route-level tests here.
