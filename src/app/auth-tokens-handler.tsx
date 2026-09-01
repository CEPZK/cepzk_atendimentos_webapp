"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
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

/**
 * Whether this page load started with credentials in the URL.
 *
 * Answered **once** per page load and remembered: the tokens are wiped
 * from the address bar as soon as the sign-in starts, so re-reading the
 * URL later would say "no" while the sign-in is still running and the
 * login form would flash behind the overlay.
 */
let arrivedWithTokens: boolean | null = null;

function readArrivedWithTokens(): boolean {
  arrivedWithTokens ??=
    window.location.pathname !== "/auth/callback" &&
    hasAuthCredentials(readAuthCallbackParams());
  return arrivedWithTokens;
}

// The answer never changes during a page load, so there is nothing to
// subscribe to — this only keeps the reading out of the server render.
const subscribe = () => () => {};
const noTokensOnTheServer = () => false;

export function AuthTokensHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [isFinished, setIsFinished] = useState(false);
  // Keeps the overlay up while the destination is being rendered, so the
  // page underneath is never shown half-way through the sign-in.
  const [isNavigating, navigate] = useTransition();

  // Read during render (not in an effect) so the overlay is there on the
  // very first paint, before the login form can flash.
  const hasTokens = useSyncExternalStore(
    subscribe,
    readArrivedWithTokens,
    noTokensOnTheServer,
  );

  useEffect(() => {
    // The dedicated callback screen handles its own URL.
    if (pathname === "/auth/callback") return;

    const params = readAuthCallbackParams();
    if (!hasAuthCredentials(params)) return;

    let cancelled = false;
    stripAuthParamsFromUrl();

    function finish() {
      // Always taken down explicitly. Relying on the navigation to
      // re-render this component leaves the overlay stuck whenever the
      // destination is the page we are already on (tokens landing on
      // "/" with next="/"), because then the route never changes.
      setIsFinished(true);
    }

    completeSignIn(params)
      .then((result) => {
        if (cancelled) return;

        if (result.ok) {
          finish();
          navigate(() => {
            // Straight to the destination: the profile completion screen
            // for first-time volunteers.
            router.replace(params.next);
            router.refresh();
          });
          return;
        }

        console.error(`[cepzk] Sign-in failed: ${result.reason}`);
        finish();
        router.replace("/login?error=1");
      })
      .catch((cause) => {
        console.error("[cepzk] Sign-in failed", cause);
        if (cancelled) return;
        finish();
        router.replace("/login?error=1");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!hasTokens || (isFinished && !isNavigating)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95">
      <p className="text-sm text-slate-500">Finalizando seu acesso...</p>
    </div>
  );
}
