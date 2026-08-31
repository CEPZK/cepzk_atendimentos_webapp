<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules (CEPZK Atendimentos)

Frontend only. The database, RLS, and Edge Functions live in `CEPZK/cepzk_atendimentos_backend`, and
`contracts/` in this repo is the interface between them.

1. **Schema changes start in `contracts/`** — edit `contracts/sql/*.sql` +
   `contracts/types/database.types.ts` in the same commit, then have the backend apply them. Never
   regenerate types and let the app follow the database.
2. **No privileged keys here.** `src/lib/env/server.ts` throws if a service-role key or `DATABASE_URL`
   is present in this project. Do not "temporarily" add one to unblock a screen; that is a contract gap —
   specify an Edge Function in `contracts/edge-functions.md`.
3. **Server-side identity is `getClaims()` only.** `getSession()` does not validate the JWT; using it as
   proof of sign-in in RSC/proxy code is a session-fixup bug waiting to happen.
4. **All backend calls go through `src/lib/api/invoke.ts`.** No ad-hoc `fetch` to `/functions/v1/*`, no
   bypassing the `{ ok, data | error }` envelope.
5. **Reads in Server Components; mutations in server actions.** TanStack Query is for the interactive
   parts only. No realtime in v1 (agreed) — refetch on focus, do not add a channel.
6. **Before committing:** `npm run check` (lint → typecheck → build). The build also catches
   `"use server"` export violations, which `tsc` alone will not.
