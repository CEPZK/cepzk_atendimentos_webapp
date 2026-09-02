"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment } from "@/lib/current-volunteer";
import { requireAssistidoAccess } from "@/lib/assistido-access";
import {
  ACA_SECTOR,
  ATENDIMENTO_FRATERNO,
  findSimilarNames,
  canonicalState,
  treatmentStateAction,
  TEA_DISTONIA,
  type Assistido,
  type SimilarAssistido,
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

/** Everyone who works in Atendimento Fraterno keeps the list. */
function requireAccess() {
  return requireDepartment(ATENDIMENTO_FRATERNO);
}

/**
 * Registered names that look like the one being typed.
 *
 * The comparison runs here and not in the database: the assistidos table
 * is small enough to read in one go, and this keeps the matching rules
 * (see `@/lib/assistido`) in the application, where they can be tuned
 * without a migration — Postgres similarity would need the `pg_trgm`
 * extension enabled in the project.
 */
export async function findSimilarAssistidos(
  nomeCompleto: string,
): Promise<{ ok: boolean; message?: string; matches: SimilarAssistido[] }> {
  const { supabase } = await requireAccess();

  const nome = nomeCompleto.trim();
  if (nome.length < 3) {
    return {
      ok: false,
      message: "Informe o nome completo do assistido.",
      matches: [],
    };
  }

  const { data, error } = await supabase
    .from("cepzk_assistido")
    .select("id, nome_completo")
    .order("nome_completo")
    .returns<Assistido[]>();

  if (error) {
    return {
      ok: false,
      message: `Não foi possível consultar os assistidos (${error.code}: ${error.message}).`,
      matches: [],
    };
  }

  return { ok: true, matches: findSimilarNames(nome, data ?? []) };
}

interface CreateInput {
  nomeCompleto: string;
  treatments: TreatmentInput[];
}

export interface CreateResult extends ActionResult {
  /** Id of the new assistido, to open their screen right away. */
  id?: number;
}

/**
 * Registers an assistido together with their first treatments.
 *
 * PostgREST has no transactions, so the rows go in one at a time and the
 * assistido is deleted again if any treatment fails — the alternative is
 * leaving behind a name with no treatment, which the screen requires.
 */
export async function createAssistido(
  input: CreateInput,
): Promise<CreateResult> {
  const { supabase, volunteer } = await requireAccess();

  const nomeCompleto = input.nomeCompleto.trim().replace(/\s+/g, " ");
  if (nomeCompleto.length < 3) {
    return { ok: false, message: "Informe o nome completo do assistido." };
  }
  if (input.treatments.length === 0) {
    return { ok: false, message: "Inclua ao menos um tratamento." };
  }

  // Precedência 0 (a entrevista do Atendimento Fraterno) não é tratamento:
  // a tela não oferece e a action também não aceita.
  const [{ data: atendimentoRows }, { data: distonias }] = await Promise.all([
    supabase
      .from("cepzk_atendimento")
      .select(ATENDIMENTO_SELECT)
      .gt("precedencia", 0)
      .returns<AtendimentoRow[]>(),
    supabase.from("aca_distonia").select("id, nome").returns<
      { id: number; nome: string }[]
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

    if (atendimento.setor === ACA_SECTOR && !treatment.distoniaId) {
      return { ok: false, message: "Informe a distonia relatada." };
    }
  }

  const { data: created, error: assistidoError } = await supabase
    .from("cepzk_assistido")
    .insert({ nome_completo: nomeCompleto, entrevistador_id: volunteer.id })
    .select("id")
    .single<{ id: number }>();

  if (assistidoError || !created) {
    // 23505 = unique_violation on nome_completo
    return {
      ok: false,
      message:
        assistidoError?.code === "23505"
          ? "Já existe um assistido cadastrado com esse nome exato."
          : `Não foi possível cadastrar (${assistidoError?.code}: ${assistidoError?.message}).`,
    };
  }

  async function rollback(message: string): Promise<CreateResult> {
    // The treatments cascade with the assistido.
    await supabase.from("cepzk_assistido").delete().eq("id", created!.id);
    return { ok: false, message };
  }

  for (const treatment of input.treatments) {
    const { data: row, error } = await supabase
      .from("cepzk_tratamento")
      .insert({
        assistido_id: created.id,
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
  return { ok: true, id: created.id, message: "Assistido cadastrado." };
}

interface TreatmentStateRow {
  id: number;
  estado: string;
  assistido_id: number;
  atendimento_id: number | null;
  atendimento: AtendimentoRow | AtendimentoRow[] | null;
}

/**
 * Moves a treatment forward: the Desobsessão Infantil gives the alta and
 * the Acolher com Amor starts the treatment that was waiting.
 *
 * The transition is decided here, from the sector and the current state,
 * and not from what the screen sent — the button only says which change
 * it wants.
 */
export async function updateTreatmentState(
  treatmentId: number,
  nextState: string,
): Promise<ActionResult> {
  const access = await requireAssistidoAccess();
  const { supabase } = access;

  const { data: treatment, error } = await supabase
    .from("cepzk_tratamento")
    .select(
      `id, estado, assistido_id, atendimento_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT})`,
    )
    .eq("id", treatmentId)
    .maybeSingle<TreatmentStateRow>();

  if (error || !treatment) {
    return {
      ok: false,
      message: error
        ? `Não foi possível ler o tratamento (${error.code}: ${error.message}).`
        : "Tratamento não encontrado.",
    };
  }

  if (!access.canManageTreatment(treatment.atendimento_id)) {
    return {
      ok: false,
      message: "Este tratamento é de outro atendimento.",
    };
  }

  const embedded = Array.isArray(treatment.atendimento)
    ? treatment.atendimento[0]
    : treatment.atendimento;
  const setor = embedded ? mapAtendimento(embedded).setor : "";

  // A transição vem da mesma regra que desenha o botão.
  const allowed = treatmentStateAction(setor, treatment.estado);

  if (!allowed || canonicalState(allowed.nextState) !== canonicalState(nextState)) {
    return {
      ok: false,
      message: `Esta mudança não é possível para o tratamento (situação atual: ${treatment.estado}).`,
    };
  }

  const { error: updateError } = await supabase
    .from("cepzk_tratamento")
    .update({
      estado: allowed.nextState,
      // A coluna existe desde a migration 006 e é a aplicação que mantém.
      data_atualizacao: new Date().toISOString(),
    })
    .eq("id", treatmentId);

  if (updateError) {
    return {
      ok: false,
      message: `Não foi possível atualizar (${updateError.code}: ${updateError.message}).`,
    };
  }

  revalidatePath("/assistidos");
  revalidatePath(`/assistidos/${treatment.assistido_id}`);
  return { ok: true, message: `Situação alterada para ${allowed.nextState}.` };
}
