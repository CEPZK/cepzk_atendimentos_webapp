# Auth contract — magic link (email OTP)

Single method for v1: **magic link**. No passwords exist, so there is no reset flow, no leaked-credential
check, and no password field anywhere in the UI. PKCE is enforced.

## 1. Flows the frontend implements

```
/login  →  signInWithOtp(email, emailRedirectTo=<origin>/auth/callback?next=…)
        →  user clicks link  →  /auth/callback?code=…&next=…
        →  exchangeCodeForSession(code)  →  Set-Cookie sb-<ref>-auth-token (HttpOnly)
        →  302 to `next` (validated: relative, same-origin, no `//host`)
```

`src/proxy.ts` refreshes the token before every non-static request using `getClaims()`.

## 2. Dashboard settings required (exact values)

| Setting                    | Value                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Providers                  | **Email → "Magic link" / OTP enabled**; password provider disabled                                                 |
| Session → Email link path  | `/auth/callback`                                                                                                   |
| Site URL                   | production origin (`https://<prod-domain>`)                                                                        |
| Redirect URLs (allow list) | `https://<prod-domain>/auth/callback`, `http://localhost:3000/auth/callback`, `https://*.vercel.app/auth/callback` |
| OTP expiry                 | ≤ 15 min (default 60 is too long for a staff tool)                                                                 |
| Rate limits                | "Rate limit for security codes": tighten to ~5/min/IP                                                              |
| SMTP                       | custom provider — Supabase's built-in sender is sandbox-only and gets dropped in production                        |
| Email subject              | `Sign in to CEPZK Atendimentos` (no reply-to on a noreply domain)                                                  |

`https://*.vercel.app/auth/callback` is not optional: without it every preview deployment's magic link
lands on the production host and QA cannot sign in on a PR.

## 3. Token / claims contract

`auth.users.app_metadata`:

```json
{ "role": "admin" | "staff" | "client" }
```

- Lives in **`app_metadata`**, never `user_metadata`. `user_metadata` is client-writable through
  `updateUser()` and would let anyone grant themselves `admin`. This is the one rule not to bend.
- RLS reads it with `(auth.jwt() -> 'app_metadata' ->> 'role')`, so role checks cost zero joins.
- `raw_user_meta_data.display_name` is _display only_ — never an authorization input.
- The frontend trusts `getClaims()` for routing and **RLS remains the security boundary**. Client-side
  role checks are cosmetic.

## 4. Provisioning (because self-signup is off by default)

`NEXT_PUBLIC_ALLOW_SELF_SIGNUP=false` ⇒ `shouldCreateUser: false`, so an unknown address gets no email.
To add someone:

```
Dashboard → Authentication → Users → Invite user  (email link, no password)
```

Then set the role, which must be done server-side (Admin API or the `provision-member` function):

```sql
update auth.users set app_metadata = jsonb_set(coalesce(app_metadata,'{}'::jsonb), '{role}', '"staff"')
where id = '<uuid>';
```

Do not rely on a UI click for role assignment: an invitee who signs in before the role is written lands
on `role = null` and sees an empty app. `profiles.status = 'invited'` exists so that state is visible
and recoverable.

## 5. Disabled accounts

Blocking sign-in is _not_ done in the frontend. Two enforcement points, both backend-owned:

1. **Auth hook (recommended):** Edge Function `auth-hook` registered as the Supabase "Custom Access
   Token" / before-user-access hook returns `{ ok: false }` when `profiles.status = 'disabled'`.
   It must run with `security definer`/service role since the user cannot read their own profile row
   while disabled.
2. **RLS backstop:** every policy ANDs `public.is_active_member()`, so an already-issued session stops
   seeing data at the next request even if the hook is missing.

Without (2), "disable user" only prevents the next sign-in and every live tab keeps working.

## 6. Failure modes the UI already handles

| Case                            | Behaviour                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Unknown email (signup off)      | 200 + no email; copy says _"if that address is registered"_ — no enumeration   |
| Expired/reused link             | generic error on `/login?error=…`, never a stack trace                         |
| `code` exchange fails           | same generic message; no oracle distinguishing causes                          |
| 5xx / `rate limit` from Auth    | distinct message, form stays editable                                          |
| Cookie gone mid-session         | proxy bounces to `/login?next=<path>` and the target is restored after sign-in |
| Open-redirect attempt in `next` | rejected by regex, falls back to `/app`                                        |

## 7. What must NOT be added without updating this file

- Any `password` provider or password field.
- Reading `getSession()` in server code as proof of identity.
- Placing the service-role key in the Vercel project (see `env-matrix.md`).
- `next` accepting an absolute URL.
