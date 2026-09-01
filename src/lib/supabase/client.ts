import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Safe to call from Client Components.
 *
 * The session is persisted in cookies so that server-rendered requests can
 * read it (see `src/lib/supabase/server.ts`).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
