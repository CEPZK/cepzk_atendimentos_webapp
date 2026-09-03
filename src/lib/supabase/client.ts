import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseConfig } from "@/lib/env";
import { SUPABASE_ENV_GLOBAL } from "@/app/supabase-env";

/** Thrown when the browser has no Supabase credentials available. */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "Supabase is not configured in the browser: no credentials were " +
        "provided by the server and NEXT_PUBLIC_SUPABASE_URL / " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY are not in the bundle.",
    );
    this.name = "SupabaseNotConfiguredError";
  }
}

/**
 * Credentials available to the browser.
 *
 * Preference order:
 * 1. the values published by the server on every render (always current);
 * 2. the `NEXT_PUBLIC_*` values inlined at build time (fallback).
 *
 * (1) exists because a deploy built without the variables — or a redeploy
 * that reused the build cache — produces a bundle where (2) is empty.
 */
export function getBrowserSupabaseConfig(): SupabaseConfig | null {
  const fromServer =
    typeof window !== "undefined"
      ? (window as unknown as Record<string, Partial<SupabaseConfig> | undefined>)[
          SUPABASE_ENV_GLOBAL
        ]
      : undefined;

  if (fromServer?.url && fromServer?.anonKey) {
    return { url: fromServer.url, anonKey: fromServer.anonKey };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anonKey) {
    return { url, anonKey };
  }

  return null;
}

/** `true` when the browser can talk to Supabase. */
export function isSupabaseConfigured(): boolean {
  return getBrowserSupabaseConfig() !== null;
}

/**
 * Browser-side Supabase client. Safe to call from Client Components.
 *
 * The session is persisted in cookies so that server-rendered requests can
 * read it (see `src/lib/supabase/server.ts`).
 */
export function createClient() {
  const config = getBrowserSupabaseConfig();
  if (!config) {
    throw new SupabaseNotConfiguredError();
  }

  return createBrowserClient(config.url, config.anonKey);
}
