import { createBrowserClient } from "@supabase/ssr";
import { requiredEnv } from "@/lib/env";

/**
 * Browser-side Supabase client. Safe to call from Client Components.
 *
 * The session is persisted in cookies so that server-rendered requests can
 * read it (see `src/lib/supabase/server.ts`).
 */
export function createClient() {
  return createBrowserClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
