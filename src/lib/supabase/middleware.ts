import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseConfig,
  warnSupabaseNotConfigured,
} from "@/lib/env";
import type { User } from "@supabase/supabase-js";

export interface SessionResult {
  /** The authenticated user, when there is one. */
  user: User | null;
  /** Response carrying the refreshed auth cookies. */
  supabaseResponse: NextResponse;
  /** `false` when the Supabase environment variables are missing. */
  isConfigured: boolean;
}

/**
 * Refreshes the user session on every request and returns the response
 * together with the authenticated user.
 *
 * This function never throws: when Supabase is not configured, or when the
 * auth request fails (network/outage), it resolves with `user: null` so the
 * proxy can keep serving the application instead of returning a 500.
 */
export async function updateSession(
  request: NextRequest,
): Promise<SessionResult> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const config = getSupabaseConfig();
  if (!config) {
    warnSupabaseNotConfigured();
    return { user: null, supabaseResponse, isConfigured: false };
  }

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: do not run any code between the client creation above and
  // the `getUser()` call below — a simple mistake could make it very hard
  // to debug users being randomly logged out.

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { user, supabaseResponse, isConfigured: true };
  } catch (error) {
    // Supabase unreachable / transient failure: treat as "no session"
    // rather than breaking every request.
    console.error("[cepzk] Failed to read the Supabase session", error);
    return { user: null, supabaseResponse, isConfigured: true };
  }
}
