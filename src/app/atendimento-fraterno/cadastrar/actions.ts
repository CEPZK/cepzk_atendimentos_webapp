"use server";

import { revalidatePath } from "next/cache";
import { requireDepartmentOnly } from "@/lib/current-volunteer";
import {
  ACA_SECTOR,
  ATENDIMENTO_FRATERNO,
  TEA_DISTONIA,
  isFinalState,
  ongoingSetors,
  type TreatmentInput,
} from "@/lib/assistido";
import {
  atendimentoLabel,
  mapAtendimento,
  one,
  ATENDIMENTO_SELECT,
  type AtendimentoItem,
  type AtendimentoRow,
} from "@/lib/atendimento";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface SaveResult extends ActionResult {
  /** Id of the saved assistido. */
  id?: number;
}

interface SaveInput {
  /** The assistido being edited. */
  assistidoId: number;
  nomeCompleto: string;
  /** The new treatments being added. */
  treatments: TreatmentInput[];
}

interface AssistidoRow {
  id: number;
  nome_completo: string;
  data_arquivamento: string | null;
}

interface ExistingTreatmentRow {
  id: number;
  estado: string;
  atendimento:
    | { setor: { nome: string } | null }
    | { setor: { nome: string } | null }[]
    | null;
}

interface TreatmentRowState {
  id: number;
  assistido_id: number;
  estado: string;
}

/** Every screen that lists treatments has to refresh after a change. */
function revalidateTreatmentPaths(assistidoId: number) {
  revalidatePath(`/assistidos/${assistidoId}`);
  revalidatePath(`/atendimento-fraterno/cadastrar/${assistidoId}`);
  // Pendente treatments feed the Acolher com Amor waiting list…
  revalidatePath("/acolher-com-amor/lista-de-espera");
  // …and the Desobsessão Infantil lists depend on the treatments too.
  revalidatePath("/desobsessao-infantil");
}

/**
 * Saves an already-registered assistido: renames it, unarchives it (the
 * treatments stay archived) and adds the new treatments.
 *
 * The volunteer reached this action from the Atendimento Fraterno's own
 * screen, so the gate is the same — the department itself, no admin
 * bypass — and it is checked again here, as in every action.
 */
export async function saveAssistido(input: SaveInput): Promise<SaveResult> {
  const { supabase } = await requireDepartmentOnly(ATENDIMENTO_FRATERNO);

  const nomeCompleto = input.nomeCompleto.trim().replace(/\s+/g, " ");
  if (nomeCompleto.length < 3) {
    return { ok: false, message: "Informe o nome completo do assistido." };
  }

  const { data: assistido, error: assistidoError } = await supabase
    .from("cepzk_assistido")
    .select("id, nome_completo, data_arquivamento")
    .eq("id", input.assistidoId)
    .maybeSingle<AssistidoRow>();

  if (assistidoError || !assistido) {
    return {
      ok: false,
      message: assistidoError
        ? `Não foi possível ler o assistido (${assistidoError.code}: ${assistidoError.message}).`
        : "Assistido não encontrado.",
    };
  }

  const [{ data: atendimentoRows }, { data: distonias }, { data: existing }] =
    await Promise.all([
      supabase
        .from("cepzk_atendimento")
        .select(ATENDIMENTO_SELECT)
        .gt("precedencia", 0)
        .returns<AtendimentoRow[]>(),
      supabase.from("aca_distonia").select("id, nome").returns<
        { id: number; nome: string }[]
      >(),
      supabase
        .from("cepzk_tratamento")
        .select(
          "id, estado, atendimento:cepzk_atendimento (setor:cepzk_setor (nome))",
        )
        .eq("assistido_id", assistido.id)
        .returns<ExistingTreatmentRow[]>(),
    ]);

  const atendimentos = new Map<number, AtendimentoItem>(
    (atendimentoRows ?? [])
      .map(mapAtendimento)
      .map((atendimento) => [atendimento.id, atendimento]),
  );
  const distoniaName = new Map((distonias ?? []).map((d) => [d.id, d.nome]));
  const seenAtendimentos = new Set<number>();

  // Sectors with an open treatment: a second treatment in the same sector
  // is refused no matter the atendimento or the horário. Alta/expirado
  // treatments free the sector again.
  const blockedSetors = ongoingSetors(
    (existing ?? []).map((row) => ({
      setor: one(row.atendimento)?.setor?.nome ?? "",
      estado: row.estado,
    })),
  );

  for (const treatment of input.treatments) {
    if (!treatment.atendimentoId) {
      return {
        ok: false,
        message: "Escolha o atendimento de cada assistência.",
      };
    }

    const atendimento = atendimentos.get(treatment.atendimentoId);
    if (!atendimento) {
      return {
        ok: false,
        message: "Este atendimento não está disponível para assistência.",
      };
    }

    if (seenAtendimentos.has(atendimento.id)) {
      return {
        ok: false,
        message: `Há duas assistências para ${atendimentoLabel(
          atendimento,
        )}. O assistido entra uma vez em cada atendimento.`,
      };
    }
    seenAtendimentos.add(atendimento.id);

    if (blockedSetors.has(atendimento.setor)) {
      return {
        ok: false,
        message: `Este assistido já tem uma assistência em andamento no setor ${atendimento.setor}. Conclua-a (alta ou expirado) antes de incluir outra.`,
      };
    }

    if (atendimento.setor === ACA_SECTOR && !treatment.distoniaId) {
      return { ok: false, message: "Informe a distonia relatada." };
    }
  }

  // Salvar renomeia e desarquiva o assistido — apenas ele, os
  // tratamentos arquivados continuam como estão.
  const { error: updateError } = await supabase
    .from("cepzk_assistido")
    .update({ nome_completo: nomeCompleto, data_arquivamento: null })
    .eq("id", assistido.id);

  if (updateError) {
    // 23505 = unique_violation on nome_completo
    return {
      ok: false,
      message:
        updateError.code === "23505"
          ? "Já existe um assistido cadastrado com esse nome exato."
          : `Não foi possível atualizar (${updateError.code}: ${updateError.message}).`,
    };
  }

  const createdIds: number[] = [];

  // PostgREST has no transactions: if any treatment fails, the ones
  // already written are removed again and the assistido goes back to
  // what it was.
  async function rollback(message: string): Promise<SaveResult> {
    if (createdIds.length > 0) {
      await supabase.from("cepzk_tratamento").delete().in("id", createdIds);
    }
    await supabase
      .from("cepzk_assistido")
      .update({
        nome_completo: assistido!.nome_completo,
        data_arquivamento: assistido!.data_arquivamento,
      })
      .eq("id", assistido!.id);
    return { ok: false, message };
  }

  for (const treatment of input.treatments) {
    const { data: row, error } = await supabase
      .from("cepzk_tratamento")
      .insert({
        assistido_id: assistido.id,
        atendimento_id: treatment.atendimentoId,
        obs: treatment.obs.trim() || null,
      })
      .select("id")
      .single<{ id: number }>();

    if (error || !row) {
      return rollback(
        `Não foi possível registrar a assistência (${error?.code}: ${error?.message}).`,
      );
    }
    createdIds.push(row.id);

    if (atendimentos.get(treatment.atendimentoId!)?.setor !== ACA_SECTOR) {
      continue;
    }

    const { error: acaError } = await supabase
      .from("aca_tratamento")
      .insert({ id: row.id, distonia_id: treatment.distoniaId });

    if (acaError) {
      return rollback(
        `Não foi possível registrar a distonia (${acaError.code}: ${acaError.message}).`,
      );
    }

    // Complaints only make sense for TEA, which is where they are asked.
    const isTea = distoniaName.get(treatment.distoniaId!) === TEA_DISTONIA;
    const queixaIds = isTea ? [...new Set(treatment.queixaIds)] : [];

    if (queixaIds.length > 0) {
      const { error: queixaError } = await supabase
        .from("aca_tratamento_queixa")
        .insert(
          queixaIds.map((queixaId) => ({
            tratamento_id: row.id,
            queixa_id: queixaId,
          })),
        );

      if (queixaError) {
        return rollback(
          `Não foi possível registrar as queixas (${queixaError.code}: ${queixaError.message}).`,
        );
      }
    }
  }

  revalidatePath("/assistidos");
  revalidatePath(`/assistidos/${assistido.id}`);
  revalidatePath(`/atendimento-fraterno/cadastrar/${assistido.id}`);
  // Os novos tratamentos pendentes entram na fila do Acolher com Amor.
  revalidatePath("/acolher-com-amor/lista-de-espera");
  // As listas da Desobsessão Infantil também dependem dos tratamentos.
  revalidatePath("/desobsessao-infantil");

  return { ok: true, id: assistido.id, message: "Cadastro atualizado." };
}

export interface UpdateTreatmentInput {
  treatmentId: number;
  atendimentoId: number | null;
  obs: string;
  distoniaId: number | null;
  queixaIds: number[];
}

/**
 * Edits an open treatment (pendente/em tratamento) registered on this
 * screen: the atendimento, the obs and the Acolher com Amor extras.
 * Concluded treatments (alta/expirado) are history and stay untouched.
 */
export async function updateTreatment(
  input: UpdateTreatmentInput,
): Promise<ActionResult> {
  const { supabase } = await requireDepartmentOnly(ATENDIMENTO_FRATERNO);

  if (!input.atendimentoId) {
    return { ok: false, message: "Escolha o atendimento da assistência." };
  }

  const { data: treatment, error: loadError } = await supabase
    .from("cepzk_tratamento")
    .select("id, assistido_id, estado")
    .eq("id", input.treatmentId)
    .maybeSingle<TreatmentRowState>();

  if (loadError || !treatment) {
    return { ok: false, message: "Assistência não encontrada." };
  }

  if (isFinalState(treatment.estado)) {
    return {
      ok: false,
      message:
        "Assistências concluídas (alta ou expirado) são histórico e não podem ser alteradas por aqui.",
    };
  }

  const [{ data: atendimentoRows }, { data: distonias }, { data: siblings }] =
    await Promise.all([
      supabase
        .from("cepzk_atendimento")
        .select(ATENDIMENTO_SELECT)
        .gt("precedencia", 0)
        .returns<AtendimentoRow[]>(),
      supabase.from("aca_distonia").select("id, nome").returns<
        { id: number; nome: string }[]
      >(),
      supabase
        .from("cepzk_tratamento")
        .select(
          "id, estado, atendimento:cepzk_atendimento (setor:cepzk_setor (nome))",
        )
        .eq("assistido_id", treatment.assistido_id)
        .neq("id", treatment.id)
        .returns<ExistingTreatmentRow[]>(),
    ]);

  const target = (atendimentoRows ?? [])
    .map(mapAtendimento)
    .find((item) => item.id === input.atendimentoId);
  if (!target) {
    return {
      ok: false,
      message: "Este atendimento não está disponível para assistência.",
    };
  }

  const blockedSetors = ongoingSetors(
    (siblings ?? []).map((row) => ({
      setor: one(row.atendimento)?.setor?.nome ?? "",
      estado: row.estado,
    })),
  );
  if (blockedSetors.has(target.setor)) {
    return {
      ok: false,
      message: `Este assistido já tem uma assistência em andamento no setor ${target.setor}. Conclua-a (alta ou expirado) antes de mover esta para lá.`,
    };
  }

  if (target.setor === ACA_SECTOR && !input.distoniaId) {
    return { ok: false, message: "Informe a distonia relatada." };
  }

  const { error: updateError } = await supabase
    .from("cepzk_tratamento")
    .update({
      atendimento_id: input.atendimentoId,
      obs: input.obs.trim() || null,
    })
    .eq("id", treatment.id);

  if (updateError) {
    return {
      ok: false,
      message: `Não foi possível atualizar (${updateError.code}: ${updateError.message}).`,
    };
  }

  // The Acolher com Amor extras are rewritten from scratch: they only
  // exist while the treatment stays in the sector.
  await supabase
    .from("aca_tratamento_queixa")
    .delete()
    .eq("tratamento_id", treatment.id);
  await supabase.from("aca_tratamento").delete().eq("id", treatment.id);

  if (target.setor === ACA_SECTOR) {
    const { error: acaError } = await supabase
      .from("aca_tratamento")
      .insert({ id: treatment.id, distonia_id: input.distoniaId });

    if (acaError) {
      return {
        ok: false,
        message: `Não foi possível registrar a distonia (${acaError.code}: ${acaError.message}).`,
      };
    }

    const distoniaName = new Map((distonias ?? []).map((d) => [d.id, d.nome]));
    const isTea =
      input.distoniaId !== null &&
      distoniaName.get(input.distoniaId) === TEA_DISTONIA;
    const queixaIds = isTea ? [...new Set(input.queixaIds)] : [];

    if (queixaIds.length > 0) {
      const { error: queixaError } = await supabase
        .from("aca_tratamento_queixa")
        .insert(
          queixaIds.map((queixaId) => ({
            tratamento_id: treatment.id,
            queixa_id: queixaId,
          })),
        );

      if (queixaError) {
        return {
          ok: false,
          message: `Não foi possível registrar as queixas (${queixaError.code}: ${queixaError.message}).`,
        };
      }
    }
  }

  revalidateTreatmentPaths(treatment.assistido_id);
  return { ok: true, message: "Assistência atualizada." };
}

/**
 * Removes an open treatment registered by mistake. Concluded treatments
 * (alta/expirado) are history and cannot be removed here.
 */
export async function removeTreatment(
  treatmentId: number,
): Promise<ActionResult> {
  const { supabase } = await requireDepartmentOnly(ATENDIMENTO_FRATERNO);

  const { data: treatment, error: loadError } = await supabase
    .from("cepzk_tratamento")
    .select("id, assistido_id, estado")
    .eq("id", treatmentId)
    .maybeSingle<TreatmentRowState>();

  if (loadError || !treatment) {
    return { ok: false, message: "Assistência não encontrada." };
  }

  if (isFinalState(treatment.estado)) {
    return {
      ok: false,
      message:
        "Assistências concluídas (alta ou expirado) são histórico e não podem ser removidas por aqui.",
    };
  }

  await supabase
    .from("aca_tratamento_queixa")
    .delete()
    .eq("tratamento_id", treatment.id);
  await supabase.from("aca_tratamento").delete().eq("id", treatment.id);

  const { error: deleteError } = await supabase
    .from("cepzk_tratamento")
    .delete()
    .eq("id", treatment.id);

  if (deleteError) {
    return {
      ok: false,
      message: `Não foi possível remover (${deleteError.code}: ${deleteError.message}).`,
    };
  }

  revalidateTreatmentPaths(treatment.assistido_id);
  return { ok: true, message: "Assistência removida." };
}
