"use server";

import { revalidatePath } from "next/cache";
import { requireDepartmentOnly } from "@/lib/current-volunteer";
import {
  ACA_SECTOR,
  ATENDIMENTO_FRATERNO,
  TEA_DISTONIA,
  canRepeatAtendimento,
  type TreatmentInput,
} from "@/lib/assistido";
import {
  atendimentoLabel,
  mapAtendimento,
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
        .select("id, atendimento_id, data_arquivamento")
        .eq("assistido_id", assistido.id)
        .returns<
          { id: number; atendimento_id: number | null; data_arquivamento: string | null }[]
        >(),
    ]);

  const atendimentos = new Map<number, AtendimentoItem>(
    (atendimentoRows ?? [])
      .map(mapAtendimento)
      .map((atendimento) => [atendimento.id, atendimento]),
  );
  const distoniaName = new Map((distonias ?? []).map((d) => [d.id, d.nome]));
  const seenAtendimentos = new Set<number>();

  for (const treatment of input.treatments) {
    if (!treatment.atendimentoId) {
      return {
        ok: false,
        message: "Escolha o atendimento de cada tratamento.",
      };
    }

    const atendimento = atendimentos.get(treatment.atendimentoId);
    if (!atendimento) {
      return {
        ok: false,
        message: "Este atendimento não está disponível para tratamento.",
      };
    }

    if (seenAtendimentos.has(atendimento.id)) {
      return {
        ok: false,
        message: `Há dois tratamentos para ${atendimentoLabel(
          atendimento,
        )}. O assistido entra uma vez em cada atendimento.`,
      };
    }
    seenAtendimentos.add(atendimento.id);

    // Repetir um atendimento que o assistido já tem só é possível quando
    // todos os tratamentos existentes dele estiverem arquivados.
    if (!canRepeatAtendimento(existing ?? [], atendimento.id)) {
      return {
        ok: false,
        message: `Este assistido já tem um tratamento ativo para ${atendimentoLabel(
          atendimento,
        )}. Para incluir outro igual, arquive antes os tratamentos existentes.`,
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
        `Não foi possível registrar o tratamento (${error?.code}: ${error?.message}).`,
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
  revalidatePath("/desobsessao-infantil-i");
  revalidatePath("/desobsessao-infantil-ii");

  return { ok: true, id: assistido.id, message: "Cadastro atualizado." };
}
