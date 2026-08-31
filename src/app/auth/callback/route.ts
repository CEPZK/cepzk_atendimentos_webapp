import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Never cached: this route writes auth cookies. */
export const dynamic = "force-dynamic";

/** Relative, same-origin path only — blocks `//host` and absolute URLs. */
const SAFE_NEXT = /^\/(?!\/)[^\s<>"'\\]*$/;

/**
 * Magic-link landing point. Supabase appends `?code=...` here; we exchange it
 * for a session (PKCE verifier comes from the `sb-*` cookies set when the
 * sign-in was requested) and then redirect into the app.
 *
 * The exchange must happen server-side so the session cookies are HttpOnly.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const failure =
    url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const rawNext = url.searchParams.get("next") ?? "/app";
  const next = SAFE_NEXT.test(rawNext) ? rawNext : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // The real cause goes to the server log only. Reflecting Supabase's
  // error_description into the browser would (a) tell an attacker which codes
  // are valid and (b) put third-party-controlled text into our own URL.
  console.warn(`[auth/callback] exchange failed: ${failure}`);
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "That sign-in link is invalid or has expired. Request a new one.",
    )}`,
  );
}
