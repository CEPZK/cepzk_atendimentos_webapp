"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/url";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Finishes the sign-in flow, whatever shape the link has:
 *
 * - **Implicit** (default Supabase e-mail templates): the tokens arrive in
 *   the URL hash — `#access_token=...&refresh_token=...&type=magiclink`.
 *   They are applied with `setSession`. NOTE: `@supabase/ssr` hardcodes
 *   `flowType: "pkce"`, and in that mode `auth-js` refuses to read the
 *   hash ("Not a valid PKCE flow url."), so the session must be set here
 *   explicitly — otherwise the user simply bounces back to /login.
 * - **PKCE**: `?code=...` exchanged for a session;
 * - **token_hash**: `?token_hash=...&type=...` verified with `verifyOtp`.
 *
 * After signing in, the user goes to the page they were trying to reach
 * (`next`), which sends first-time users to the profile completion screen.
 */
export function AuthCallback() {
  const router = useRouter();
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    // Supabase sends the tokens in the fragment; it is never sent to the
    // server, so everything below has to happen in the browser.
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const param = (name: string) =>
      url.searchParams.get(name) ?? hashParams.get(name);

    const code = url.searchParams.get("code");
    const tokenHash = param("token_hash");
    const otpType = param("type");
    const errorCode = param("error") ?? param("error_code");
    const next = sanitizeNextPath(param("next"));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    // Clean the address bar before creating the client: it keeps the
    // tokens out of the history and prevents auth-js from trying (and
    // failing) to parse an implicit callback while in PKCE mode.
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search,
      );
    }

    let cancelled = false;
    const slowTimer = window.setTimeout(() => setIsSlow(true), 4000);

    function failed(reason: string) {
      console.error(`[cepzk] Sign-in callback failed: ${reason}`);
      if (!cancelled) router.replace("/login?error=1");
    }

    async function finishSignIn() {
      if (errorCode) {
        failed(errorCode);
        return;
      }

      if (!isSupabaseConfigured()) {
        console.error("[cepzk] Sign-in callback failed: Supabase not configured");
        if (!cancelled) router.replace("/login?error=config");
        return;
      }

      const supabase = createClient();

      if (accessToken && refreshToken) {
        // Implicit flow (magic link / invite with the default templates).
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          failed(error.message);
          return;
        }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          failed(error.message);
          return;
        }
      } else if (tokenHash && otpType) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: otpType as EmailOtpType,
        });
        if (error) {
          failed(error.message);
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        failed("no session after the callback");
        return;
      }

      // The proxy reads the session from the cookies written above, so the
      // destination already knows the user is signed in and can send them
      // to /complete-profile when the profile is incomplete.
      router.replace(next);
      router.refresh();
    }

    finishSignIn().catch((cause) => {
      failed(cause instanceof Error ? cause.message : String(cause));
    });

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <p className="text-sm text-slate-500">Finalizando seu acesso...</p>
        {isSlow && (
          <p className="mt-2 text-xs text-slate-400">
            Isso está demorando mais que o normal. Aguarde alguns instantes.
          </p>
        )}
      </div>
    </main>
  );
}
