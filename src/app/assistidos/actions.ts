"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment } from "@/lib/current-volunteer";
import {
  ACA_SECTOR,
  ATENDIMENTO_FRATERNO,
  findSimilarNames,
  TEA_DISTONIA,
  type Assistido,
  type SimilarAssistido,
  type TreatmentInput,
} from "@/lib/assistido";

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

  const [{ data: sectors }, { data: distonias }] = await Promise.all([
    supabase.from("cepzk_setor").select("id, nome").returns<
      { id: number; nome: string }[]
    >(),
    supabase.from("aca_distonia").select("id, nome").returns<
      { id: number; nome: string }[]
    >(),
  ]);

  const sectorName = new Map((sectors ?? []).map((s) => [s.id, s.nome]));
  const distoniaName = new Map((distonias ?? []).map((d) => [d.id, d.nome]));
  const seenSectors = new Set<number>();

  for (const treatment of input.treatments) {
    if (!treatment.setorId || !treatment.horarioId) {
      return {
        ok: false,
        message: "Escolha o setor e o horário de cada tratamento.",
      };
    }
    if (seenSectors.has(treatment.setorId)) {
      return {
        ok: false,
        message: `Há dois tratamentos para o setor ${
          sectorName.get(treatment.setorId) ?? treatment.setorId
        }. O assistido tem um tratamento por setor.`,
      };
    }
    seenSectors.add(treatment.setorId);

    if (
      sectorName.get(treatment.setorId) === ACA_SECTOR &&
      !treatment.distoniaId
    ) {
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
        setor_id: treatment.setorId,
        horario_id: treatment.horarioId,
        obs: treatment.obs.trim() || null,
      })
      .select("id")
      .single<{ id: number }>();

    if (error || !row) {
      return rollback(
        `Não foi possível registrar o tratamento (${error?.code}: ${error?.message}).`,
      );
    }

    if (sectorName.get(treatment.setorId!) !== ACA_SECTOR) continue;

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
