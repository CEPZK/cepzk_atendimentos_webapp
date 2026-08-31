import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@contracts/types/database.types";
import { publicEnv } from "@/lib/env/public";

/**
 * Server Component / Server Action / Route Handler client.
 *
 * Cookies are the source of truth for the session; the browser client is never
 * consulted on the server. `setAll` is wrapped because Next.js freezes the
 * cookie store inside Server Components — refreshes there are a no-op and are
 * performed by src/proxy.ts instead (see the caching note in contracts/auth.md).
 */
export async function createClient() {
  const { url, key } = publicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookieOptions: {
      // Vercel serves preview + production over https; keep SameSite strict
      // so the magic-link callback (cross-site from the mail client) still
      // works — that flow lands on /auth/callback via a top-level navigation.
      sameSite: "lax",
      secure: url.startsWith("https://"),
      path: "/",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: read-only. Proxy handles refresh.
        }
      },
    },
  });
}
