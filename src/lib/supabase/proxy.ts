import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@contracts/types/database.types";
import { publicEnv } from "@/lib/env/public";

/** URL prefixes that require a session. Matched with startsWith(). */
const PROTECTED_PREFIXES = ["/app"];
/** Routes only for signed-out users. */
const AUTH_ROUTES = ["/login"];

export function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the Supabase auth token and enforces coarse routing.
 *
 * Two rules that are easy to get wrong and are load-bearing here:
 *  1. `getClaims()` (not `getSession()`) is the only call that validates the
 *     JWT signature. `getSession()` reads local storage and can be spoofed.
 *  2. No `await` between `createServerClient` and the claims read, and every
 *     branch returns `supabaseResponse`, or refreshed cookies are dropped and
 *     users get randomly logged out.
 *
 * This is a route guard, not a security boundary: RLS is what protects data.
 */
export async function updateSession(request: NextRequest) {
  const { url, key } = publicEnv();
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const signedIn = !error && Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!signedIn && isProtected(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Only stash same-origin relative targets; never an absolute URL.
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname);
    }
    return redirectKeepingCookies(loginUrl, supabaseResponse);
  }

  if (signedIn && isAuthRoute(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/app";
    homeUrl.search = "";
    return redirectKeepingCookies(homeUrl, supabaseResponse);
  }

  return supabaseResponse;
}

/**
 * NextResponse.redirect() creates a brand-new response, which silently discards
 * the refreshed auth cookies that this function just wrote. Re-apply them.
 */
function redirectKeepingCookies(location: URL, from: NextResponse) {
  const response = NextResponse.redirect(location);
  for (const cookie of from.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}
