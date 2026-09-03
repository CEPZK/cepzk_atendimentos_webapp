"use server";

import { revalidatePath } from "next/cache";
import { requireDepartment } from "@/lib/current-volunteer";
import { requireAssistidoAccess } from "@/lib/assistido-access";
import {
  ACA_SECTOR,
  ATENDIMENTO_FRATERNO,
  findSimilarNames,
  isAcolherComAmor,
  canonicalState,
  treatmentStateAction,
  ESTADO_EM_TRATAMENTO,
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
import {
  matchesSchedule,
  parseHorario,
  sessionDates,
  SESSION_COUNT,
  SESSION_INTERVAL_DAYS,
} from "@/lib/aca-agenda";

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
  // Quem sai de "pendente" sai da fila do Acolher com Amor.
  revalidatePath("/acolher-com-amor/lista-de-espera");
  // As listas da Desobsessão Infantil também dependem do estado.
  revalidatePath("/desobsessao-infantil-i");
  revalidatePath("/desobsessao-infantil-ii");
  return { ok: true, message: `Situação alterada para ${allowed.nextState}.` };
}

// -----------------------------------------------------------------------------
// Acolher com Amor — agenda
// -----------------------------------------------------------------------------

export interface ScheduleSessionInput {
  /** Instant of the session, in ISO. */
  data: string;
  procedimentoIds: number[];
}

interface ScheduleInput {
  treatmentId: number;
  sessions: ScheduleSessionInput[];
}

/**
 * Starts an Acolher com Amor treatment: writes the sessions (with their
 * procedures) and moves the treatment to "em tratamento".
 *
 * The dates come from the screen but are checked here against the
 * atendimento's own schedule — a session can only fall on a day the
 * atendimento actually happens, at its hour, and the sessions must be
 * `SESSION_INTERVAL_DAYS` apart. PostgREST has no transactions, so the
 * sessions are removed again if anything after them fails.
 */
export async function scheduleAcaTreatment(
  input: ScheduleInput,
): Promise<ActionResult> {
  const access = await requireAssistidoAccess();
  const { supabase } = access;

  const { data: treatment, error } = await supabase
    .from("cepzk_tratamento")
    .select(
      `id, estado, assistido_id, atendimento_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT})`,
    )
    .eq("id", input.treatmentId)
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
    return { ok: false, message: "Este tratamento é de outro atendimento." };
  }

  const embedded = Array.isArray(treatment.atendimento)
    ? treatment.atendimento[0]
    : treatment.atendimento;
  const atendimento = embedded ? mapAtendimento(embedded) : null;

  // A mesma regra que desenha o botão "Iniciar Tratamento".
  const allowed = atendimento
    ? treatmentStateAction(atendimento.setor, treatment.estado)
    : null;

  if (!atendimento || !allowed || allowed.nextState !== ESTADO_EM_TRATAMENTO) {
    return {
      ok: false,
      message: `Este tratamento não pode ser agendado (situação atual: ${treatment.estado}).`,
    };
  }

  const schedule = parseHorario(atendimento.horario);
  if (!schedule) {
    return {
      ok: false,
      message: `Não foi possível ler o dia e a hora do atendimento ("${atendimento.horario}").`,
    };
  }

  if (input.sessions.length !== SESSION_COUNT) {
    return { ok: false, message: `Informe as ${SESSION_COUNT} sessões.` };
  }

  const dates = input.sessions.map((session) => new Date(session.data));
  if (dates.some((date) => Number.isNaN(date.getTime()))) {
    return { ok: false, message: "Data de sessão inválida." };
  }

  // As datas têm de ser as do próprio atendimento, espaçadas de 15 dias.
  const expected = sessionDates(dates[0]);
  const onSchedule = matchesSchedule(dates[0], schedule);

  if (
    !onSchedule ||
    dates.some((date, index) => date.getTime() !== expected[index].getTime())
  ) {
    return {
      ok: false,
      message: `As sessões precisam cair em ${atendimento.horario}, a cada ${SESSION_INTERVAL_DAYS} dias.`,
    };
  }

  const { data: procedimentos } = await supabase
    .from("aca_procedimento")
    .select("id")
    .returns<{ id: number }[]>();
  const validProcedimentos = new Set((procedimentos ?? []).map((p) => p.id));

  for (const session of input.sessions) {
    const ids = session.procedimentoIds;
    if (new Set(ids).size !== ids.length) {
      return {
        ok: false,
        message: "Um procedimento não pode se repetir na mesma sessão.",
      };
    }
    if (ids.some((id) => !validProcedimentos.has(id))) {
      return { ok: false, message: "Procedimento inválido." };
    }
  }

  // Reagendar não é este fluxo: se já há sessões, algo saiu do lugar.
  const { data: existing } = await supabase
    .from("aca_sessao")
    .select("id")
    .eq("tratamento_id", treatment.id)
    .returns<{ id: number }[]>();

  if ((existing ?? []).length > 0) {
    return { ok: false, message: "Este tratamento já tem sessões agendadas." };
  }

  const { data: created, error: sessaoError } = await supabase
    .from("aca_sessao")
    .insert(
      input.sessions.map((session) => ({
        tratamento_id: treatment.id,
        data: new Date(session.data).toISOString(),
      })),
    )
    .select("id, data")
    .returns<{ id: number; data: string }[]>();

  if (sessaoError || !created || created.length !== input.sessions.length) {
    return {
      ok: false,
      message: `Não foi possível agendar as sessões (${sessaoError?.code}: ${sessaoError?.message}).`,
    };
  }

  async function rollback(message: string): Promise<ActionResult> {
    await supabase
      .from("aca_sessao")
      .delete()
      .in("id", (created ?? []).map((row) => row.id));
    return { ok: false, message };
  }

  const byInstant = new Map(
    created.map((row) => [new Date(row.data).getTime(), row.id]),
  );

  const links = input.sessions.flatMap((session) => {
    const sessaoId = byInstant.get(new Date(session.data).getTime());
    return session.procedimentoIds.map((procedimentoId) => ({
      sessao_id: sessaoId!,
      procedimento_id: procedimentoId,
    }));
  });

  if (links.some((link) => !link.sessao_id)) {
    return rollback("Não foi possível associar os procedimentos às sessões.");
  }

  if (links.length > 0) {
    const { error: linkError } = await supabase
      .from("aca_sessao_procedimento")
      .insert(links);

    if (linkError) {
      return rollback(
        `Não foi possível registrar os procedimentos (${linkError.code}: ${linkError.message}).`,
      );
    }
  }

  const { error: updateError } = await supabase
    .from("cepzk_tratamento")
    .update({
      estado: ESTADO_EM_TRATAMENTO,
      data_atualizacao: new Date().toISOString(),
    })
    .eq("id", treatment.id);

  if (updateError) {
    return rollback(
      `Não foi possível atualizar a situação (${updateError.code}: ${updateError.message}).`,
    );
  }

  revalidatePath("/assistidos");
  revalidatePath(`/assistidos/${treatment.assistido_id}`);
  // Quem sai de "pendente" sai da fila do Acolher com Amor.
  revalidatePath("/acolher-com-amor/lista-de-espera");
  // As novas sessões entram no calendário do Acolher com Amor.
  revalidatePath("/acolher-com-amor/calendario");
  // As listas da Desobsessão Infantil também dependem do estado.
  revalidatePath("/desobsessao-infantil-i");
  revalidatePath("/desobsessao-infantil-ii");
  return {
    ok: true,
    message: `Tratamento agendado em ${SESSION_COUNT} sessões.`,
  };
}

interface SessionProceduresInput {
  sessaoId: number;
  procedimentoIds: number[];
}

interface UpdateProceduresInput {
  treatmentId: number;
  sessions: SessionProceduresInput[];
}

/**
 * Updates the procedures of an already-scheduled Acolher com Amor
 * treatment: for each session, replaces the recorded procedures with the
 * ones the team sent.
 *
 * The screen is reached from the sessions calendar, and the check that
 * the volunteer manages this atendimento is repeated here, as in every
 * action. PostgREST has no transactions, so each session swaps its
 * procedures one at a time (removes the current ones, writes the new).
 */
export async function updateAcaTreatmentProcedures(
  input: UpdateProceduresInput,
): Promise<ActionResult> {
  const access = await requireAssistidoAccess();
  const { supabase } = access;

  const { data: treatment, error } = await supabase
    .from("cepzk_tratamento")
    .select(
      `id, estado, assistido_id, atendimento_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT})`,
    )
    .eq("id", input.treatmentId)
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
    return { ok: false, message: "Este tratamento é de outro atendimento." };
  }

  const embedded = Array.isArray(treatment.atendimento)
    ? treatment.atendimento[0]
    : treatment.atendimento;
  const atendimento = embedded ? mapAtendimento(embedded) : null;

  if (!atendimento || !isAcolherComAmor(atendimento.setor)) {
    return { ok: false, message: "Este tratamento não é do Acolher com Amor." };
  }

  // As sessões que já existem: a edição é apenas dos procedimentos delas.
  const { data: sessions } = await supabase
    .from("aca_sessao")
    .select("id")
    .eq("tratamento_id", treatment.id)
    .returns<{ id: number }[]>();

  const sessionIds = new Set((sessions ?? []).map((row) => row.id));
  if (sessionIds.size === 0) {
    return {
      ok: false,
      message: "Este tratamento ainda não tem sessões agendadas.",
    };
  }

  const receivedIds = new Set<number>();
  for (const session of input.sessions) {
    if (!sessionIds.has(session.sessaoId)) {
      return {
        ok: false,
        message: "Sessão não encontrada neste tratamento.",
      };
    }
    if (receivedIds.has(session.sessaoId)) {
      return { ok: false, message: "Há sessões repetidas." };
    }
    receivedIds.add(session.sessaoId);
  }
  if (receivedIds.size !== sessionIds.size) {
    return {
      ok: false,
      message: "Todas as sessões do tratamento precisam ser enviadas.",
    };
  }

  const { data: procedimentos } = await supabase
    .from("aca_procedimento")
    .select("id")
    .returns<{ id: number }[]>();
  const validProcedimentos = new Set((procedimentos ?? []).map((p) => p.id));

  for (const session of input.sessions) {
    const ids = session.procedimentoIds;
    if (new Set(ids).size !== ids.length) {
      return {
        ok: false,
        message: "Um procedimento não pode se repetir na mesma sessão.",
      };
    }
    if (ids.some((id) => !validProcedimentos.has(id))) {
      return { ok: false, message: "Procedimento inválido." };
    }
  }

  for (const session of input.sessions) {
    const { error: deleteError } = await supabase
      .from("aca_sessao_procedimento")
      .delete()
      .eq("sessao_id", session.sessaoId);

    if (deleteError) {
      return {
        ok: false,
        message: `Não foi possível atualizar a sessão (${deleteError.code}: ${deleteError.message}).`,
      };
    }

    if (session.procedimentoIds.length === 0) continue;

    const { error: insertError } = await supabase
      .from("aca_sessao_procedimento")
      .insert(
        session.procedimentoIds.map((procedimentoId) => ({
          sessao_id: session.sessaoId,
          procedimento_id: procedimentoId,
        })),
      );

    if (insertError) {
      return {
        ok: false,
        message: `Não foi possível registrar os procedimentos (${insertError.code}: ${insertError.message}).`,
      };
    }
  }

  revalidatePath("/acolher-com-amor/calendario");
  revalidatePath(`/assistidos/${treatment.assistido_id}`);
  return { ok: true, message: "Sessões atualizadas." };
}
