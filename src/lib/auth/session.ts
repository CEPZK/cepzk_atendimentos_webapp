import "server-only";
import { redirect } from "next/navigation";
import type { AppRole, SessionClaims } from "@contracts/types/database.types";
import { createClient } from "@/lib/supabase/server";

export type Principal = {
  id: string;
  email: string;
  /** Absent for accounts whose app_metadata was set before roles existed. */
  role: AppRole | null;
};

/**
 * Verified identity for the current request.
 *
 * `getClaims()` validates the JWT signature (locally via WebCrypto + cached
 * JWKS for asymmetric-key projects) — this is the ONLY server-side primitive
 * the app uses to decide "is this person signed in".
 */
export async function getPrincipal(): Promise<Principal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) return null;

  const claims = data.claims as unknown as SessionClaims;
  if (!claims.sub) return null;

  return {
    id: claims.sub,
    email: claims.email ?? "",
    role: claims.app_metadata?.role ?? null,
  };
}

/** Server Components should render from this, never from getPrincipal() + manual check. */
export async function requirePrincipal(next = "/app"): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return principal;
}

/** Fresh user record from the Auth server (network round-trip) — use only when you need up-to-date profile data. */
export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
