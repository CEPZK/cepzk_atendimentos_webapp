import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, isProfileComplete, type Volunteer } from "@/lib/volunteer";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CurrentVolunteer {
  supabase: SupabaseClient;
  volunteer: Volunteer;
}

const VOLUNTEER_COLUMNS = "id, nome, sobrenome, email, telefone, papel";

/**
 * Loads the signed-in volunteer.
 *
 * Redirects to the login screen when there is no session and to the
 * profile completion screen while the profile is incomplete, so every
 * page behind it can assume a complete profile.
 */
export async function requireVolunteer(): Promise<CurrentVolunteer> {
  const supabase = await createClient();
  if (!supabase) {
    redirect("/login?error=config");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: volunteer } = await supabase
    .from("cepzk_voluntario")
    .select(VOLUNTEER_COLUMNS)
    .eq("id", user.id)
    .maybeSingle<Volunteer>();

  if (!volunteer || !isProfileComplete(volunteer)) {
    redirect("/complete-profile");
  }

  return { supabase, volunteer };
}

/**
 * Same as `requireVolunteer`, but only for admins.
 *
 * The database still grants full access to every authenticated user
 * (RLS v1), so this check is what actually protects the administration
 * screens — it must be repeated inside every Server Action.
 */
export async function requireAdmin(): Promise<CurrentVolunteer> {
  const current = await requireVolunteer();
  if (!isAdmin(current.volunteer)) {
    redirect("/");
  }
  return current;
}
