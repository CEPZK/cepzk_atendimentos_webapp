# Edge Function contract

Anything that needs a transaction, a secret, an external call, or a permission the caller does not have
runs here. The frontend calls these through `src/lib/api/invoke.ts` and nothing else.

## 1. Inventory (v1)

| Name                 | Trigger            | Purpose                                                        | Auth                           |
| -------------------- | ------------------ | -------------------------------------------------------------- | ------------------------------ |
| `provision-member`   | admin UI           | create/invite user, set `app_metadata.role`, insert `profiles` | `admin`                        |
| `deprovision-member` | admin UI           | disable, revoke sessions                                       | `admin`                        |
| `send-support-email` | domain TBD         | outbound SMTP/WhatsApp side effect                             | `staff`                        |
| `auth-hook`          | Supabase Auth hook | reject disabled accounts, stamp custom claims                  | service (platform)             |
| `webhook-<channel>`  | 3rd-party inbound  | verify signature, upsert thread/messages                       | signature, **no** user session |

Names are kebab-case, one function per directory under `supabase/functions/<name>/`. Names are a public
API: `/functions/v1/<name>` is callable by anyone holding the publishable key, so a rename requires a
coordinated PR in both repos.

## 2. Response envelope — every function, no exceptions

```ts
// success
{ ok: true, data: T, meta?: { requestId?: string } }

// failure
{ ok: false, error: {
    code: "unauthorized" | "forbidden" | "not_found" | "validation_error"
        | "conflict" | "rate_limited" | "internal_error",
    message: string,                 // safe to show to the end user
    fieldErrors?: Record<string, string[]>
} }
```

Rules the implementation must follow:

1. **`message` is user-visible.** No stack traces, no SQL fragments, no "connection refused to
   db-xyz.supabase.co". Log the detail server-side with `requestId`; return the code.
2. Return `200` with `ok:false` for `validation_error`/`conflict`, and the matching HTTP status for
   auth failures (`401`) and `internal_error` (`500`). The client treats the envelope as authoritative
   and status as advisory — but `401` must be a real 401 so the proxy can clear the session.
3. **Never trust the caller's `user_id` in the body.** Derive it from the bearer token:
   `supabase.auth.getUser(token)` with the request's `Authorization` header, then re-check role.
4. Re-validate every field. A function that trusts the UI's zod schema is a hole, because the publishable
   key is public.
5. `OPTIONS *` → `204` with CORS headers; `Content-Type: application/json` on all responses.
6. Idempotency: accept an optional `Idempotency-Key` header on writes and store it (`unique` index) so a
   retried request after a timeout cannot create a second atendimento.
7. Timeout: `WaitUntil` nothing after the response; kill outbound fetches with an `AbortSignal.timeout(8_000)`.

## 3. Skeleton the backend repo should start from

```ts
// supabase/functions/_shared/respond.ts
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
export const err = (code: string, message: string, status = 200) =>
  json({ ok: false, error: { code, message } }, status);

// supabase/functions/<name>/index.ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const requestId = crypto.randomUUID();
  try {
    const anon = supabaseClient(ANON_KEY); // ← user-scoped, so RLS applies
    const { data, error } = await anon.auth.getUser(
      req.headers.get("authorization")?.replace(/^Bearer /, ""),
    );
    if (error || !data.user) return err("unauthorized", "Sign in again.", 401);

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success)
      return json({
        ok: false,
        error: {
          code: "validation_error",
          message: "Some fields need attention.",
          fieldErrors: flatten(parsed.error),
        },
      });

    return json({
      ok: true,
      data: await handler(parsed.data),
      meta: { requestId },
    });
  } catch (e) {
    console.error(requestId, e);
    return err("internal_error", "Something went wrong on our side.", 500);
  }
});
```

Use the **anon key + caller's token** by default so RLS enforces the function's reach. Take the service
role only for the specific statement that needs it, inside a scoped client, and say why in a comment.

## 4. Client surface the frontend already implements

```ts
await invokeFunction<Response, Request>("provision-member", { email, role });
// throws ApiError { code, status, fieldErrors } on ok:false or transport failure
```

- `unauthorized` → the app clears the session and sends the user to `/login`.
- `validation_error` + `fieldErrors` → mapped onto form fields.
- `conflict` → inline "already exists" notice, never a toast storm.
- `internal_error` → generic retry affordance; the UI must not render `error.message` for this code.

Anything the frontend needs that is _not_ in this envelope is a contract change: edit this file first.
