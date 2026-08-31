/**
 * Public (browser-visible) environment configuration.
 *
 * Only `NEXT_PUBLIC_*` vars may be read here. Anything secret belongs in
 * ./server.ts. Inlined `process.env.X` access is required by webpack's
 * dead-code elimination — do not destructure `process.env`.
 */
import { z } from "zod";

/**
 * Publishable key is the current Supabase naming (`sb_publishable_...`).
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` is still accepted so an existing project
 * can be wired up without renaming vars; it is legacy and should migrate.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .url({ message: "must be a valid URL" })
    .refine(
      (v) => /^https:\/\/[a-z0-9-]+\.supabase\.(co|in|red)$/i.test(v),
      "expected an https://<ref>.supabase.co project URL",
    ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  /**
   * Magic-link self-signup. `false` (default) sends `shouldCreateUser: false`,
   * so an unknown email gets no email — matching an internal staff tool.
   * Flip to `true` only when onboarding is handled by sending invites.
   */
  NEXT_PUBLIC_ALLOW_SELF_SIGNUP: z.enum(["true", "false"]).default("false"),
});

const parsed = PublicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_ALLOW_SELF_SIGNUP: process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP,
});

export type PublicEnv = {
  url: string;
  /** Publishable (or legacy anon) key. Client-safe by design: RLS is the boundary. */
  key: string;
  allowSelfSignup: boolean;
};

/**
 * Throws instead of silently producing a broken client — a missing env var on
 * Vercel surfaces as this message in the build log, not as a 500 at runtime.
 */
export function publicEnv(): PublicEnv {
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid public environment configuration.\n${issues}\n\n` +
        `Copy .env.example to .env.local (and set the same keys in Vercel \u2192 Project Settings \u2192 Environment Variables).`,
    );
  }

  const key =
    parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    key,
    allowSelfSignup: parsed.data.NEXT_PUBLIC_ALLOW_SELF_SIGNUP === "true",
  };
}
