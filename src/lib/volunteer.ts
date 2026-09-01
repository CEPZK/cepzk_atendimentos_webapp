/**
 * Volunteer profile as stored in `cepzk_voluntario`.
 *
 * `nome` is mirrored from the Supabase Auth metadata by the database
 * triggers; `sobrenome` and `telefone` are filled in by the volunteer
 * himself in the platform.
 */
export interface VolunteerProfile {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
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
