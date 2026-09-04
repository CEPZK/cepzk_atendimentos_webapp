"use server";

import { revalidatePath } from "next/cache";
import { requireSector } from "@/lib/current-volunteer";
import { ACA_SECTOR, isAcolherComAmor } from "@/lib/assistido";
import {
  mapAtendimento,
  ATENDIMENTO_SELECT,
  type AtendimentoRow,
} from "@/lib/atendimento";

export interface ReportSubmission {
  sessaoId: number;
  tratamentoId: number;
  dirigenteId: string;
  ponteId: string;
  obs: string;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Registra (cria) um relatório por assistido para o dia escolhido.
 *
 * Cada submissão traz o `sessaoId` da sessão daquele dia e os ids do
 * dirigente, do ponte e a observação. As checagens aqui garantem que
 * o voluntário tem acesso ao Acolher com Amor, que a sessão existe
 * mesmo e que o tratamento é do Acolher com Amor.
 *
 * Sem transações no PostgREST: cada insert é independente, mas como
 * tudo é uma nova linha do relatório isso é o que queremos (e a
 * exclusão em cascata de `aca_relatorio.sessao_id` apaga qualquer
 * relatório antigo se uma sessão for recadastrada).
 */
export async function registerAcaRelatorios(
  submissions: ReportSubmission[],
): Promise<ActionResult> {
  const { supabase } = await requireSector(ACA_SECTOR);

  if (!Array.isArray(submissions) || submissions.length === 0) {
    return {
      ok: false,
      message: "Selecione ao menos um assistido para registrar.",
    };
  }

  // Validação e normalização dos campos de cada submissão.
  const cleaned: {
    sessaoId: number;
    tratamentoId: number;
    dirigenteId: string;
    ponteId: string;
    obs: string | null;
  }[] = [];

  for (const sub of submissions) {
    if (
      !Number.isInteger(sub.sessaoId) ||
      !Number.isInteger(sub.tratamentoId)
    ) {
      return { ok: false, message: "Sessão inválida." };
    }
    const dirigenteId = sub.dirigenteId?.trim();
    const ponteId = sub.ponteId?.trim();
    if (!dirigenteId || !ponteId) {
      return { ok: false, message: "Dirigente e ponte são obrigatórios." };
    }
    if (dirigenteId === ponteId) {
      return {
        ok: false,
        message: "Dirigente e ponte precisam ser voluntários diferentes.",
      };
    }
    cleaned.push({
      sessaoId: sub.sessaoId,
      tratamentoId: sub.tratamentoId,
      dirigenteId,
      ponteId,
      obs: sub.obs?.trim() ? sub.obs.trim() : null,
    });
  }

  // Confere que cada sessão existe e pertence a um tratamento do
  // Acolher com Amor. Esta checagem é mais barata do que parece (1
  // query para todas as sessões), e a permissão por setor já foi
  // validada pelo requireSector.
  const sessaoIds = [...new Set(cleaned.map((c) => c.sessaoId))];
  const { data: sessoes, error: sessaoError } = await supabase
    .from("aca_sessao")
    .select(
      `id, tratamento:cepzk_tratamento (id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT}))`,
    )
    .in("id", sessaoIds)
    .returns<
      {
        id: number;
        tratamento:
          | {
              id: number;
              atendimento: AtendimentoRow | AtendimentoRow[] | null;
            }
          | {
              id: number;
              atendimento: AtendimentoRow | AtendimentoRow[] | null;
            }[]
          | null;
      }[]
    >();

  if (sessaoError) {
    return {
      ok: false,
      message: `Não foi possível ler as sessões (${sessaoError.code}: ${sessaoError.message}).`,
    };
  }

  const sessaoToTratamento = new Map<number, number>();
  for (const sessao of sessoes ?? []) {
    const tratamento = Array.isArray(sessao.tratamento)
      ? sessao.tratamento[0]
      : sessao.tratamento;
    if (!tratamento) continue;
    const atendimentoRow = Array.isArray(tratamento.atendimento)
      ? tratamento.atendimento[0]
      : tratamento.atendimento;
    const atendimento = atendimentoRow ? mapAtendimento(atendimentoRow) : null;
    if (!atendimento || !isAcolherComAmor(atendimento.setor)) continue;
    sessaoToTratamento.set(sessao.id, tratamento.id);
  }

  for (const sub of cleaned) {
    const tratamentoId = sessaoToTratamento.get(sub.sessaoId);
    if (tratamentoId !== sub.tratamentoId) {
      return {
        ok: false,
        message: "Sessão não pertence ao Acolher com Amor.",
      };
    }
  }

  // Confere que dirigente e ponte são voluntários escalados no
  // Acolher com Amor: garante que o combobox é a única fonte dos
  // ids (a tela só permite escolher da lista, mas o servidor repete
  // a checagem).
  const voluntarioIds = [
    ...new Set(cleaned.flatMap((c) => [c.dirigenteId, c.ponteId])),
  ];

  const { data: escalas, error: escalaError } = await supabase
    .from("cepzk_escala")
    .select(
      `voluntario_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT})`,
    )
    .in("voluntario_id", voluntarioIds)
    .returns<
      {
        voluntario_id: string;
        atendimento: AtendimentoRow | AtendimentoRow[] | null;
      }[]
    >();

  if (escalaError) {
    return {
      ok: false,
      message: `Não foi possível ler a escala (${escalaError.code}: ${escalaError.message}).`,
    };
  }

  const validAcaVolunteers = new Set<string>();
  for (const row of escalas ?? []) {
    const atendimentoRow = Array.isArray(row.atendimento)
      ? row.atendimento[0]
      : row.atendimento;
    const atendimento = atendimentoRow ? mapAtendimento(atendimentoRow) : null;
    if (atendimento && isAcolherComAmor(atendimento.setor)) {
      validAcaVolunteers.add(row.voluntario_id);
    }
  }

  for (const sub of cleaned) {
    if (
      !validAcaVolunteers.has(sub.dirigenteId) ||
      !validAcaVolunteers.has(sub.ponteId)
    ) {
      return {
        ok: false,
        message:
          "Dirigente e ponte precisam ser voluntários escalados no Acolher com Amor.",
      };
    }
  }

  // Insere os relatórios: um insert por submissão (sem transações
  // no PostgREST). Se algum falhar, devolvemos o erro; como cada um
  // cria uma nova linha, não há risco de duplicar dados.
  for (const sub of cleaned) {
    const { error: insertError } = await supabase
      .from("aca_relatorio")
      .insert({
        sessao_id: sub.sessaoId,
        dirigente_id: sub.dirigenteId,
        ponte_id: sub.ponteId,
        obs: sub.obs,
      });

    if (insertError) {
      return {
        ok: false,
        message: `Não foi possível registrar o relatório (${insertError.code}: ${insertError.message}).`,
      };
    }
  }

  revalidatePath("/acolher-com-amor/relatorios");
  revalidatePath("/acolher-com-amor/calendario");
  return {
    ok: true,
    message:
      cleaned.length === 1
        ? "Relatório registrado."
        : `${cleaned.length} relatórios registrados.`,
  };
}
