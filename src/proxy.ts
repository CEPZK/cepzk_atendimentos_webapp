import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime, same API).
 * Supabase needs this layer because Server Components cannot write cookies,
 * so token refresh has to happen before rendering.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static assets + the Vercel image optimizer; everything else runs the
  // refresh path. Note: /auth/callback MUST run so the code exchange can
  // persist cookies before redirecting.
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
