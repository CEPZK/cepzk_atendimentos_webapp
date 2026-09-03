"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/current-volunteer";
import { VOLUNTEER_ROLES, type VolunteerRole } from "@/lib/volunteer";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** Digits, spaces and + ( ) - only, with at least 8 digits. */
function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 8;
}

/**
 * Updates the editable fields of a volunteer.
 *
 * `email` is not editable here: it is mirrored from Supabase Auth by a
 * database trigger, so changing it in the table alone would desync both.
 */
export async function updateVolunteer(
  volunteerId: string,
  input: {
    nome: string;
    sobrenome: string;
    telefone: string;
    papel: VolunteerRole;
  },
): Promise<ActionResult> {
  const { supabase, volunteer: currentUser } = await requireAdmin();

  const nome = input.nome.trim();
  const sobrenome = input.sobrenome.trim();
  const telefone = input.telefone.trim();

  if (!nome) {
    return { ok: false, message: "O nome é obrigatório." };
  }
  if (telefone && !isValidPhone(telefone)) {
    return { ok: false, message: "Informe um telefone válido." };
  }
  if (!VOLUNTEER_ROLES.includes(input.papel)) {
    return { ok: false, message: "Papel inválido." };
  }
  if (currentUser.id === volunteerId && input.papel !== "admin") {
    return {
      ok: false,
      message:
        "Você não pode remover o seu próprio papel de administrador — peça a outro administrador.",
    };
  }

  const { error } = await supabase
    .from("cepzk_voluntario")
    .update({
      nome,
      sobrenome: sobrenome || null,
      telefone: telefone || null,
      papel: input.papel,
    })
    .eq("id", volunteerId);

  if (error) {
    return {
      ok: false,
      message: `Não foi possível salvar (${error.code}: ${error.message}).`,
    };
  }

  revalidatePath("/voluntarios");
  revalidatePath(`/voluntarios/${volunteerId}`);
  return { ok: true, message: "Dados atualizados." };
}

/** Associates the volunteer with an atendimento (sector + schedule). */
export async function addScheduleEntry(
  volunteerId: string,
  atendimentoId: number,
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  if (!Number.isInteger(atendimentoId)) {
    return { ok: false, message: "Selecione o atendimento." };
  }

  const { error } = await supabase.from("cepzk_escala").insert({
    voluntario_id: volunteerId,
    atendimento_id: atendimentoId,
  });

  if (error) {
    // 23505 = unique_violation (already associated with this atendimento)
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "Este voluntário já está nessa escala."
          : `Não foi possível associar (${error.code}: ${error.message}).`,
    };
  }

  revalidatePath(`/voluntarios/${volunteerId}`);
  return { ok: true, message: "Escala associada." };
}

/** Removes the volunteer from an atendimento. */
export async function removeScheduleEntry(
  volunteerId: string,
  atendimentoId: number,
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("cepzk_escala")
    .delete()
    .eq("voluntario_id", volunteerId)
    .eq("atendimento_id", atendimentoId);

  if (error) {
    return {
      ok: false,
      message: `Não foi possível desassociar (${error.code}: ${error.message}).`,
    };
  }

  revalidatePath(`/voluntarios/${volunteerId}`);
  return { ok: true, message: "Escala removida." };
}
