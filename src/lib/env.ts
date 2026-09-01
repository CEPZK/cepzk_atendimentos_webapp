/**
 * Returns the value of a required environment variable, failing with a
 * clear message when it is missing (e.g. before the variables are
 * configured in the Vercel dashboard).
 */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        "Configure it in the Vercel project settings (or .env.local locally).",
    );
  }
  return value;
}
