import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@contracts/types/database.types";
import { publicEnv } from "@/lib/env/public";

/**
 * Client Component client (reads/writes Supabase cookies via the browser).
 *
 * Do NOT use this in Server Components to read auth state: it is unvalidated
 * there. Server-side reads go through ./server.ts + getClaims().
 */
export function createClient() {
  const { url, key } = publicEnv();
  return createBrowserClient<Database>(url, key);
}
