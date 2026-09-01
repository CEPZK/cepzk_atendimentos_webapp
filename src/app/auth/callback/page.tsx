"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/url";

/**
 * Finishes the sign-in flow:
 *
 * - Magic link (PKCE): exchanges the `code` query parameter for a session;
 * - Magic link / invite (implicit): the tokens arrive in the URL hash
 *   fragment (`#access_token=...&refresh_token=...`) and are applied here.
 *
 * After signing in, the user is redirected to the page they were trying to
 * reach (`next`), which in turn sends first-time users to the profile
 * completion screen.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );

    const code = url.searchParams.get("code");
    const error =
      url.searchParams.get("error") ?? hashParams.get("error");
    const next = sanitizeNextPath(
      url.searchParams.get("next") ?? hashParams.get("next"),
    );
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    let cancelled = false;

    function failed() {
      if (!cancelled) router.replace("/login?error=1");
    }

    async function finishSignIn() {
      if (error) {
        failed();
        return;
      }

      const supabase = createClient();

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          failed();
          return;
        }
      } else if (accessToken && refreshToken) {
        // Implicit flow (invites and magic links configured without PKCE).
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setSessionError) {
          failed();
          return;
        }
        // Remove the tokens from the address bar.
        window.history.replaceState(null, "", url.pathname + url.search);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session) {
        router.replace(next);
        router.refresh();
      } else {
        failed();
      }
    }

    finishSignIn().catch((cause) => {
      // Missing configuration or an unreachable Supabase must not leave the
      // user stuck on the "finishing" screen.
      console.error("[cepzk] Sign-in callback failed", cause);
      failed();
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <p className="text-sm text-slate-500">Finalizando seu acesso...</p>
    </main>
  );
}
