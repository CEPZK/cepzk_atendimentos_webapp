/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ CONTRACT FILE — SHARED BY BOTH REPOS                                    │
 * │ cepzk_atendimentos_web (this file is the FE copy of the contract)       │
 * │ cepzk_atendimentos_backend (source of truth = generated from your DB)   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Region 1 (IDENTITY) below is frozen and is what the frontend compiles
 * against today. Region 2 (DOMAIN) is intentionally empty until the schema
 * is agreed; `npm run types:generate` overwrites THIS file from the live
 * project and the FE re-verifies against it.
 *
 * Regenerate with:
 *   SUPABASE_PROJECT_REF=<ref> npm run types:generate
 * which runs:
 *   supabase gen types typescript --project-id <ref> --schema public
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/* ───────────────────────── Region 1: IDENTITY (frozen) ─────────────────── */

/**
 * Roles live in `auth.users.app_metadata`, not in a join table, so RLS
 * policies can read them straight from the JWT with zero extra queries.
 * Adding a role = code change in both repos by design (see contracts/auth.md).
 */
export type AppRole = "admin" | "staff" | "client";

export type ProfileStatus = "active" | "invited" | "disabled";

export type Profile = {
  /** Same uuid as auth.users.id (1:1, no surrogate key). */
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
};

/* ────────────────────────── Region 2: DOMAIN (pending) ─────────────────── */
/*
 * Populated once the domain is described in contracts/README.md §3.
 * Until then the frontend renders no data-dependent screens.
 */

/* ─────────────────────────────── Database type ─────────────────────────── */

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "email">;
        Update: Partial<Profile>;
        Relationships: [];
      };
    };
    Views: Record<PropertyKey, never>;
    Functions: {
      current_app_role: {
        Args: Record<PropertyKey, never>;
        Returns: AppRole | null;
      };
      is_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      /**
       * is_active_member() is intentionally ABSENT: it is a security-definer
       * helper used inside policies, has no `execute` grant for `authenticated`,
       * and leaking it into the RPC surface invites a probe for "which accounts
       * are active". Omitting it makes `.rpc('is_active_member')` a compile
       * error, which is the correct amount of "you can't do that".
       */
    };
    Enums: {
      app_role: AppRole;
      profile_status: ProfileStatus;
    };
    CompositeTypes: Record<PropertyKey, never>;
  };
};

/* ─────────────────────────── Convenience helpers ───────────────────────── */

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

/**
 * Shape of the verified JWT as returned by `supabase.auth.getClaims()`.
 * The frontend trusts ONLY these fields for routing decisions, and RLS
 * remains the actual security boundary for data access.
 */
export type SessionClaims = {
  sub: string;
  email: string;
  role: "authenticated" | "anon";
  app_metadata?: { role?: AppRole };
  user_metadata?: { display_name?: string };
  /** Seconds since epoch. */
  exp: number;
  iat: number;
  iss: string;
  aud: string;
};
