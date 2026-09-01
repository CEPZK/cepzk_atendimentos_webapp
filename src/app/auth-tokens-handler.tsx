"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  completeSignIn,
  hasAuthCredentials,
  readAuthCallbackParams,
  stripAuthParamsFromUrl,
} from "@/lib/auth-callback";

/**
 * Completes the sign-in when the tokens land on a page other than
 * `/auth/callback`.
 *
 * Supabase only honours `emailRedirectTo` when the URL is in the redirect
 * allowlist; otherwise it falls back to the project's **Site URL** — very
 * often the bare domain. The tokens then arrive at `/`, the proxy sends
 * that request to `/login` (the fragment survives the redirect) and the
 * user just sees the login form again.
 *
 * Mounted in the root layout, this component picks those tokens up
 * wherever they land, so signing in no longer depends on the Supabase
 * dashboard being configured just right.
 */
export function AuthTokensHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [hasFailed, setHasFailed] = useState(false);

  // Detected during render (not in an effect) so the overlay shows up on
  // the very first paint, before the login form flashes.
  const hasTokens = useSyncExternalStore(
    () => () => {},
    () =>
      pathname !== "/auth/callback" &&
      hasAuthCredentials(readAuthCallbackParams()),
    () => false,
  );

  useEffect(() => {
    // The dedicated callback screen handles its own URL.
    if (pathname === "/auth/callback") return;

    const params = readAuthCallbackParams();
    if (!hasAuthCredentials(params)) return;

    let cancelled = false;
    stripAuthParamsFromUrl();

    completeSignIn(params)
      .then((result) => {
        if (cancelled) return;

        if (result.ok) {
          // Straight to the destination: the profile completion screen for
          // first-time volunteers.
          router.replace(params.next);
          router.refresh();
          return;
        }

        console.error(`[cepzk] Sign-in failed: ${result.reason}`);
        setHasFailed(true);
        router.replace("/login?error=1");
      })
      .catch((cause) => {
        console.error("[cepzk] Sign-in failed", cause);
        if (cancelled) return;
        setHasFailed(true);
        router.replace("/login?error=1");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!hasTokens || hasFailed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95">
      <p className="text-sm text-slate-500">Finalizando seu acesso...</p>
    </div>
  );
}
