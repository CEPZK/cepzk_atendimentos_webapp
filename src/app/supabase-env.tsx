import { getSupabaseConfig, warnSupabaseNotConfigured } from "@/lib/env";

/** Global used to hand the Supabase configuration to the browser. */
export const SUPABASE_ENV_GLOBAL = "__CEPZK_SUPABASE__";

/**
 * Publishes the Supabase configuration to the browser **at request time**.
 *
 * `NEXT_PUBLIC_*` variables are inlined into the client bundle during the
 * build, so a deploy that reused a build cache (or that was built before
 * the variables existed) ships a bundle without them — the server works
 * while every browser call fails with "Missing required environment
 * variable". Reading the values from the rendered HTML keeps client and
 * server always in sync.
 *
 * Only the public URL and the anon key are exposed — both are meant to be
 * visible in the browser.
 */
export function SupabaseEnvScript() {
  const config = getSupabaseConfig();

  if (!config) {
    warnSupabaseNotConfigured();
  }

  const payload = JSON.stringify(config ?? {}).replace(/</g, "\\u003c");

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.${SUPABASE_ENV_GLOBAL}=${payload};`,
      }}
    />
  );
}
