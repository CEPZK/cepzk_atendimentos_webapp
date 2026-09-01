"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/url";

/**
 * Finishes the sign-in flow:
 *
 * - Magic link (PKCE): exchanges the `code` query parameter for a session;
 * - Invite link: the access token arrives in the URL hash fragment and is
 *   captured automatically by the Supabase client when the session is read.
 *
 * After signing in, the user is redirected to the page they were trying to
 * reach (`next`), which in turn sends first-time users to the profile
 * completion screen.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const next = sanitizeNextPath(url.searchParams.get("next"));

    let cancelled = false;

    async function finishSignIn() {
      if (error) {
        router.replace(`/login?error=1`);
        return;
      }

      const supabase = createClient();

      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) router.replace(`/login?error=1`);
          return;
        }
      }

      // For invites the tokens are detected in the URL hash here.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session) {
        router.replace(next);
        router.refresh();
      } else {
        router.replace(`/login?error=1`);
      }
    }

    finishSignIn();
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
