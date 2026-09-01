import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Route protection:
 * - refreshes the session on every request (keeps the user logged in);
 * - logged-out users are redirected to /login;
 * - logged-in users never see the login screen again.
 */
export async function proxy(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request);

  const { pathname } = request.nextUrl;

  // The login screen and the auth callback finish the magic link / invite
  // flow, so they must stay accessible without a session.
  const isPublicPath =
    pathname === "/login" || pathname === "/auth/callback";

  // Static files and PWA assets are served as-is.
  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/");

  if (isStaticAsset) {
    return supabaseResponse;
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on everything except static assets.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
