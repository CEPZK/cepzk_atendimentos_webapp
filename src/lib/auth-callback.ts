import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/url";
import type { EmailOtpType } from "@supabase/supabase-js";

export interface AuthCallbackParams {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  tokenHash: string | null;
  otpType: string | null;
  errorCode: string | null;
  next: string;
}

/**
 * Reads the sign-in credentials from the current URL.
 *
 * Supabase may deliver them in several shapes and — depending on the
 * project's "Site URL" / redirect allowlist — to **any** path, not only to
 * `/auth/callback`:
 *
 * - implicit: `#access_token=...&refresh_token=...` (default e-mail links);
 * - PKCE: `?code=...`;
 * - `?token_hash=...&type=...`.
 */
export function readAuthCallbackParams(): AuthCallbackParams {
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  );
  const param = (name: string) =>
    url.searchParams.get(name) ?? hashParams.get(name);

  return {
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    code: url.searchParams.get("code"),
    tokenHash: param("token_hash"),
    otpType: param("type"),
    errorCode: param("error") ?? param("error_code"),
    next: sanitizeNextPath(param("next")),
  };
}

/** `true` when the URL carries something that can create a session. */
export function hasAuthCredentials(params: AuthCallbackParams): boolean {
  return Boolean(params.accessToken || params.code || params.tokenHash);
}

/**
 * Removes the tokens from the address bar (and from the history entry)
 * before the Supabase client is created — `@supabase/ssr` runs in PKCE
 * mode and errors out when it finds an implicit callback in the URL.
 */
export function stripAuthParamsFromUrl(): void {
  const url = new URL(window.location.href);
  const hadHash = Boolean(window.location.hash);

  for (const name of ["code", "token_hash", "type", "error", "error_code"]) {
    url.searchParams.delete(name);
  }

  if (hadHash || url.search !== window.location.search) {
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search,
    );
  }
}

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: string; message?: string };

/** Turns the credentials found in the URL into an active session. */
export async function completeSignIn(
  params: AuthCallbackParams,
): Promise<SignInResult> {
  if (params.errorCode) {
    return { ok: false, reason: params.errorCode };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      reason: "Supabase credentials are missing in the browser",
      message:
        "A plataforma não está configurada corretamente (credenciais do Supabase ausentes). Avise um administrador.",
    };
  }

  const supabase = createClient();

  if (params.accessToken && params.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) return { ok: false, reason: error.message };
  } else if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) return { ok: false, reason: error.message };
  } else if (params.tokenHash && params.otpType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.tokenHash,
      type: params.otpType as EmailOtpType,
    });
    if (error) return { ok: false, reason: error.message };
  } else {
    return { ok: false, reason: "no credentials in the callback URL" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session
    ? { ok: true }
    : { ok: false, reason: "no session after the callback" };
}
