/**
 * Returns the value of a required environment variable, failing with a
 * clear message when it is missing (e.g. before the variables are
 * configured in the Vercel dashboard).
 */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(missingEnvMessage(name));
  }
  return value;
}

/** Human readable message for a missing environment variable. */
export function missingEnvMessage(name: string): string {
  return (
    `Missing required environment variable: ${name}. ` +
    "Configure it in the Vercel project settings (or .env.local locally)."
  );
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

/**
 * Supabase credentials, or `null` when they are not configured.
 *
 * These variables are inlined at build time, so a deploy made before they
 * were added to the project settings ships without them. Callers running
 * on the server (proxy, Server Components) must degrade gracefully
 * instead of throwing — an exception in the proxy turns *every* route
 * into an "Internal Server Error".
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

/** Logs, once per cold start, that Supabase is not configured. */
let warned = false;
export function warnSupabaseNotConfigured(): void {
  if (warned) return;
  warned = true;
  console.error(
    "[cepzk] Supabase is not configured: " +
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. " +
      "Add them to the Vercel project settings and redeploy " +
      "(the values are inlined at build time).",
  );
}

/**
 * Optional WhatsApp group invite link shown on the home screen.
 *
 * Any person with the invite link can open the group preview and join,
 * even without being a member — the group just needs link invites
 * enabled (default) and the invite must not have been revoked.
 *
 * Returns `null` when unset or invalid, so the app keeps working without
 * the button (the home screen simply hides it).
 */
export function getWhatsAppGroupLink(): string | null {
  const value = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_LINK?.trim();
  if (!value) return null;

  const isValid =
    /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+$/u.test(value);
  if (!isValid) {
    console.error(
      "[cepzk] NEXT_PUBLIC_WHATSAPP_GROUP_LINK is not a valid WhatsApp " +
        "group invite link (expected https://chat.whatsapp.com/<code>). " +
        "The home screen button will be hidden. " +
        "How to get it: WhatsApp → open the group → Group info → " +
        "Invite via link → Copy link.",
    );
    return null;
  }

  return value;
}
