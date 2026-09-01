/**
 * Volunteer profile as stored in `cepzk_voluntario`.
 *
 * `nome` and `email` are mirrored from the Supabase Auth metadata by the
 * database triggers; `sobrenome` and `telefone` are filled in by the
 * volunteer himself in the platform.
 */
export interface VolunteerProfile {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
}

/** Roles defined by the `papel_voluntario` enum. */
export type VolunteerRole = "admin" | "coordenador" | "colaborador";

export const VOLUNTEER_ROLES: VolunteerRole[] = [
  "admin",
  "coordenador",
  "colaborador",
];

export const ROLE_LABELS: Record<VolunteerRole, string> = {
  admin: "Administrador",
  coordenador: "Coordenador",
  colaborador: "Colaborador",
};

/** Full volunteer record. */
export interface Volunteer extends VolunteerProfile {
  email: string;
  papel: VolunteerRole;
  data_criacao?: string;
}

/** One row of `cepzk_escala`, joined with the atendimento catalogue. */
export interface ScheduleEntry {
  atendimento_id: number;
  setor: string;
  departamento: string | null;
  horario: string;
}

/**
 * A profile is only complete when the volunteer informed their first
 * name, last name and phone number — all of them are required.
 */
export function isProfileComplete(
  profile: Pick<VolunteerProfile, "nome" | "sobrenome" | "telefone">,
): boolean {
  return Boolean(
    profile.nome?.trim() &&
      profile.sobrenome?.trim() &&
      profile.telefone?.trim(),
  );
}

/** Only admins invite volunteers and change roles. */
export function isAdmin(volunteer: { papel?: string | null } | null): boolean {
  return volunteer?.papel === "admin";
}

/** "Nome Sobrenome", falling back to whatever is available. */
export function fullName(
  volunteer: Pick<VolunteerProfile, "nome" | "sobrenome">,
): string {
  return [volunteer.nome, volunteer.sobrenome]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

/** Initials used by the avatar bubbles. */
export function initials(
  volunteer: Pick<VolunteerProfile, "nome" | "sobrenome">,
): string {
  const letters = [volunteer.nome, volunteer.sobrenome]
    .map((part) => part?.trim()?.[0])
    .filter(Boolean)
    .join("");
  return (letters || "?").toUpperCase();
}
