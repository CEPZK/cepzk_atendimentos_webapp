import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, isProfileComplete, type Volunteer } from "@/lib/volunteer";
import {
  mapAtendimento,
  ATENDIMENTO_SELECT,
  type AtendimentoItem,
  type AtendimentoRow,
} from "@/lib/atendimento";
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

interface ScheduleRow {
  atendimento: AtendimentoRow | null;
}

/**
 * Atendimentos the volunteer is scheduled for.
 *
 * This is the key to the whole authorization model outside the
 * Atendimento Fraterno: a volunteer sees the assistidos (and the
 * treatments) of the atendimentos they actually work in.
 */
export const loadVolunteerAtendimentos = cache(async (
  supabase: SupabaseClient,
  volunteerId: string,
): Promise<AtendimentoItem[]> => {
  const { data } = await supabase
    .from("cepzk_escala")
    .select(`atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT})`)
    .eq("voluntario_id", volunteerId)
    .returns<ScheduleRow[]>();

  const atendimentos = (data ?? [])
    .map((row) => row.atendimento)
    .filter((row): row is AtendimentoRow => Boolean(row))
    .map(mapAtendimento);

  return [
    ...new Map(atendimentos.map((item) => [item.id, item])).values(),
  ];
});

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
  const atendimentos = await loadVolunteerAtendimentos(supabase, volunteerId);

  const sectors = atendimentos
    .filter((atendimento) => atendimento.setorId !== null)
    .map((atendimento) => ({
      id: atendimento.setorId as number,
      nome: atendimento.setor,
      departamento: atendimento.departamento,
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

/** Whether these sectors give access to a specific sector's features. */
export function belongsToSector(
  sectors: VolunteerSector[],
  sector: string,
): boolean {
  return sectors.some((item) => item.nome === sector);
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

/**
 * Same as `requireDepartment`, but without the admin bypass: only who
 * actually works in `department` gets through (admins included only when
 * they are scheduled there). The Atendimento Fraterno's own screens use
 * this — the admins keep the Lista de Assistidos instead.
 *
 * Like every other gate, it must be repeated inside the Server Actions
 * of those screens.
 */
export const requireDepartmentOnly = cache(async (
  department: string,
): Promise<CurrentVolunteer> => {
  const current = await requireVolunteer();

  const sectors = await loadVolunteerSectors(
    current.supabase,
    current.volunteer.id,
  );
  if (!belongsToDepartment(sectors, department)) {
    redirect("/");
  }

  return current;
});

/**
 * Same as `requireVolunteer`, but only for who works in `sector` —
 * admins always get through.
 *
 * Some features belong to a single sector rather than a whole
 * department (the Acolher com Amor waiting list, e.g.) — this is the
 * real gate and must be repeated inside every Server Action of those
 * screens.
 */
export const requireSector = cache(async (
  sector: string,
): Promise<CurrentVolunteer> => {
  const current = await requireVolunteer();
  if (isAdmin(current.volunteer)) return current;

  const sectors = await loadVolunteerSectors(
    current.supabase,
    current.volunteer.id,
  );
  if (!belongsToSector(sectors, sector)) {
    redirect("/");
  }

  return current;
});
