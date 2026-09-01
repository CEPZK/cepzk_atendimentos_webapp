import "server-only";

import { cache } from "react";
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
 * The request's Supabase client.
 *
 * Cached per request so a page and its `generateMetadata` share one
 * client — and, more importantly, so the guard below runs its network
 * calls only once per navigation.
 */
export const getSupabase = cache(async (): Promise<SupabaseClient> => {
  const supabase = await createClient();
  if (!supabase) {
    redirect("/login?error=config");
  }
  return supabase;
});

/**
 * Loads the signed-in volunteer.
 *
 * Redirects to the login screen when there is no session and to the
 * profile completion screen while the profile is incomplete, so every
 * page behind it can assume a complete profile.
 */
export const requireVolunteer = cache(async (): Promise<CurrentVolunteer> => {
  const supabase = await getSupabase();

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
});

/** A sector the volunteer is scheduled for, with its department. */
export interface VolunteerSector {
  id: number;
  nome: string;
  departamento: string | null;
}

interface ScheduleSectorRow {
  atendimento: {
    setor: {
      id: number;
      nome: string;
      departamento: { nome: string } | null;
    } | null;
  } | null;
}

/**
 * Sectors the volunteer works in, taken from the schedule.
 *
 * This is what releases the features on the home screen: each card
 * belongs to a department, and only who is scheduled for it (plus the
 * admins) gets to see it.
 */
export const loadVolunteerSectors = cache(async (
  supabase: SupabaseClient,
  volunteerId: string,
): Promise<VolunteerSector[]> => {
  const { data } = await supabase
    .from("cepzk_escala")
    .select(
      "atendimento:cepzk_atendimento (setor:cepzk_setor (id, nome, departamento:cepzk_departamento (nome)))",
    )
    .eq("voluntario_id", volunteerId)
    .returns<ScheduleSectorRow[]>();

  const sectors = (data ?? [])
    .map((row) => row.atendimento?.setor ?? null)
    .filter((sector): sector is NonNullable<
      NonNullable<ScheduleSectorRow["atendimento"]>["setor"]
    > => Boolean(sector))
    .map((sector) => ({
      id: sector.id,
      nome: sector.nome,
      departamento: sector.departamento?.nome ?? null,
    }));

  return [...new Map(sectors.map((sector) => [sector.id, sector])).values()];
});

/** Whether these sectors give access to a department's features. */
export function belongsToDepartment(
  sectors: VolunteerSector[],
  department: string,
): boolean {
  return sectors.some((sector) => sector.departamento === department);
}

/**
 * Same as `requireVolunteer`, but only for admins.
 *
 * The database still grants full access to every authenticated user
 * (RLS v1), so this check is what actually protects the administration
 * screens — it must be repeated inside every Server Action.
 */
export const requireAdmin = cache(async (): Promise<CurrentVolunteer> => {
  const current = await requireVolunteer();
  if (!isAdmin(current.volunteer)) {
    redirect("/");
  }
  return current;
});

/**
 * Same as `requireVolunteer`, but only for who works in `department` —
 * admins always get through.
 *
 * The database still grants full access to every authenticated user
 * (RLS v1), so this is the real gate and must be repeated inside every
 * Server Action of the department's screens.
 */
export const requireDepartment = cache(async (
  department: string,
): Promise<CurrentVolunteer> => {
  const current = await requireVolunteer();
  if (isAdmin(current.volunteer)) return current;

  const sectors = await loadVolunteerSectors(
    current.supabase,
    current.volunteer.id,
  );
  if (!belongsToDepartment(sectors, department)) {
    redirect("/");
  }

  return current;
});
