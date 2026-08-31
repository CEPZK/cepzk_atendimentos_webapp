/**
 * Server-only env. Also acts as a guard rail: this file is imported by
 * `next.config.ts`-adjacent server code and by the root layout check, so a
 * mis-deployed secret fails the build instead of leaking a session.
 */
import "server-only";
import { z } from "zod";

const ServerEnvSchema = z.object({
  /**
   * Used by /api/revalidate-style webhooks if the backend ever pushes events to us.
   * Optional: absence just disables that route.
   */
  INTERNAL_WEBHOOK_SECRET: z.string().min(16).optional(),
});

/**
 * Keys that must NEVER exist in the Vercel project. The service-role key
 * bypasses Row Level Security, and a Next.js deployment ships its server
 * bundle to a general-purpose host. It belongs only in Supabase Edge Function
 * secrets. See contracts/env-matrix.md.
 */
const FORBIDDEN = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "POSTGRES_PASSWORD",
] as const;

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function serverEnv(): ServerEnv {
  const leaked = FORBIDDEN.filter((k) => Boolean(process.env[k]));
  if (leaked.length > 0) {
    throw new Error(
      `Refusing to start: privileged secret(s) found in the web app environment: ${leaked.join(
        ", ",
      )}.\nThese must live in Supabase Edge Function secrets (supabase secrets set ...), not in Vercel.\nSee contracts/env-matrix.md`,
    );
  }

  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment: ${JSON.stringify(parsed.error.issues, null, 2)}`,
    );
  }
  return parsed.data;
}

/** Best-effort origin resolution: works on Vercel prod, preview deploys, and localhost. */
export function requestOrigin(headers: Headers): string {
  const host =
    headers.get("x-forwarded-host") ??
    headers.get("host") ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!host) return "http://localhost:3000";
  const proto =
    headers.get("x-forwarded-proto") ??
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
