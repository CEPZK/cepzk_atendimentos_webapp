# Environment matrix — who may hold which secret

Two hosts, two trust levels. The Vercel project is a **general-purpose host with a public URL**; the
Supabase project runs our SQL with `service_role` bypassing RLS. Secrets do not cross.

| Variable                                       | Vercel (web)  | Supabase Edge Function secrets | Supabase `db` (never exported) |
| ---------------------------------------------- | ------------- | ------------------------------ | ------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                     | ✅            | ✅ (`SUPABASE_URL`)            | —                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`         | ✅            | ✅ (`SUPABASE_ANON_KEY`)       | —                              |
| `NEXT_PUBLIC_ALLOW_SELF_SIGNUP`                | ✅            | —                              | —                              |
| `INTERNAL_WEBHOOK_SECRET`                      | ✅ (optional) | ✅ (same value)                | —                              |
| `SUPABASE_SERVICE_ROLE_KEY`                    | ❌ **never**  | ✅                             | —                              |
| `DATABASE_URL` / `DIRECT_URL` / psql superuser | ❌ **never**  | ❌ (migrations via CI only)    | n/a                            |
| SMTP creds, WhatsApp/Email provider token      | ❌            | ✅                             | —                              |
| `ANTIFRAUD_*`, analytics write keys            | ❌            | ✅ per function                | —                              |

## Hard rule in the frontend

`src/lib/env/server.ts` enumerates `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_KEY`,
`DATABASE_URL`, `DIRECT_URL`, `POSTGRES_PASSWORD` and **throws** if any is present. That is a build-time
guard, not a runtime nicety: the failure mode it prevents is a "temporarily" unblocking of a server
action, which quietly turns a public Vercel deployment into a database admin console. The right fix is an
Edge Function; if you genuinely need a privileged read on the server, propose it in
`contracts/edge-functions.md`.

## Key naming

Supabase rotated from `anon`/`service_role` JWTs to `sb_publishable_…` / `sb_secret_…`. Legacy `anon`
keys are still accepted (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) so an existing project works unchanged, but do
not create new ones: legacy keys are long-lived JWTs signed with the project `JWT_SECRET`, and that
secret is also what invalidates every session at once. Publishable/secret keys are scoped per key and can
be rotated independently.

## Local dev

```
# web
cp .env.example .env.local           # point at the remote (or local) project
npm run dev                          # http://localhost:3000

# backend repo, if you prefer an offline database
supabase start && supabase db reset
# then .env.local points at http://127.0.0.1:54321 with the CLI's local keys
# and the login flow needs NEXT_PUBLIC_ALLOW_SELF_SIGNUP=true (no SMTP locally:
# use the magic-link URL printed by `supabase auth link` / the mail catcher)
```

`http://localhost:3000/auth/callback` must be in the dashboard Redirect URL list, or local sign-in
redirects to Site URL and appears broken.
