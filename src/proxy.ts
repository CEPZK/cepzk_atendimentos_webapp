import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// The login screen and the auth callback finish the magic link / invite
// flow, so they must stay accessible without a session.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    // Configuration self-check: must be reachable while signed out,
    // otherwise it cannot diagnose a broken login.
    pathname === "/diagnostico"
  );
}

// Static files and PWA assets are served as-is.
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/")
  );
}

/**
 * Route protection:
 * - refreshes the session on every request (keeps the user logged in);
 * - logged-out users are redirected to /login;
 * - logged-in users never see the login screen again.
 *
 * Any unexpected failure here must NOT break the site: an exception thrown
 * by the proxy makes every matched route answer "Internal Server Error".
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  try {
    const { user, supabaseResponse, isConfigured } =
      await updateSession(request);

    // Without credentials there is no way to authenticate anyone. Send
    // every request to /login, which explains what is missing instead of
    // failing with a blank 500.
    if (!isConfigured) {
      if (isPublicPath(pathname)) {
        return supabaseResponse;
      }
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "config");
      return NextResponse.redirect(loginUrl);
    }

    if (user && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (!user && !isPublicPath(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
  } catch (error) {
    console.error("[cepzk] Proxy failure", error);

    // Fail open for the public pages and fail safe (back to /login) for
    // everything else.
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: [
    // Run on everything except static assets.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
