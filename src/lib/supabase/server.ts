import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig, warnSupabaseNotConfigured } from "@/lib/env";

/**
 * Server-side Supabase client for Server Components, Route Handlers and
 * Server Actions. Always create a new client per request.
 *
 * Returns `null` when the environment variables are missing, so callers can
 * redirect to /login instead of crashing the whole render.
 */
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) {
    warnSupabaseNotConfigured();
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
