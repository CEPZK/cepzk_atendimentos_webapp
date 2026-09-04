import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapAtendimento,
  one,
  ATENDIMENTO_SELECT,
  type AtendimentoRow,
} from "@/lib/atendimento";
import type { AcaRelatorio } from "@/lib/aca-relatorio";

interface RelatorioRow {
  id: number;
  sessao_id: number;
  obs: string | null;
  sessao:
    | {
        id: number;
        data: string;
        tratamento:
          | {
              id: number;
              assistido_id: number;
              assistido: { id: number; nome_completo: string } | null;
            }
          | null;
        procedimentos: { procedimento: { nome: string } | null }[] | null;
      }
    | {
        id: number;
        data: string;
        tratamento:
          | {
              id: number;
              assistido_id: number;
              assistido: { id: number; nome_completo: string } | null;
            }
          | null;
        procedimentos: { procedimento: { nome: string } | null }[] | null;
      }[]
    | null;
  dirigente:
    | { id: string; nome: string; sobrenome: string | null }
    | { id: string; nome: string; sobrenome: string | null }[]
    | null;
  ponte:
    | { id: string; nome: string; sobrenome: string | null }
    | { id: string; nome: string; sobrenome: string | null }[]
    | null;
}

interface AssistidoTratamentoRow {
  assistido_id: number;
  atendimento: AtendimentoRow | AtendimentoRow[] | null;
}

function volunteerName(
  v:
    | { nome: string; sobrenome: string | null }
    | { nome: string; sobrenome: string | null }[]
    | null,
): string {
  const r = one(v);
  if (!r) return "—";
  return [r.nome, r.sobrenome].filter(Boolean).join(" ") || "—";
}

/**
 * Carrega todos os relatórios do Acolher com Amor, já com o nome do
 * assistido, os procedimentos da sessão, o nome do dirigente e o nome do
 * ponte, e a lista de tratamentos do assistido (todos os setores).
 *
 * Ordenado pela data da sessão, da mais nova para a mais antiga.
 */
export async function loadRelatorios(
  supabase: SupabaseClient,
): Promise<{ relatorios: AcaRelatorio[]; error: { code: string; message: string } | null }> {
  const { data: relatorioRows, error: relatorioError } = await supabase
    .from("aca_relatorio")
    .select(
      `id, sessao_id, obs,
       sessao:aca_sessao (
         id, data,
         tratamento:cepzk_tratamento (
           id, assistido_id, assistido:cepzk_assistido (id, nome_completo)
         ),
         procedimentos:aca_sessao_procedimento (procedimento:aca_procedimento (nome))
       ),
       dirigente:cepzk_voluntario!aca_relatorio_dirigente_id_fkey (id, nome, sobrenome),
       ponte:cepzk_voluntario!aca_relatorio_ponte_id_fkey (id, nome, sobrenome)`,
    )
    .order("sessao(data)", { ascending: false })
    .returns<RelatorioRow[]>();

  if (relatorioError) {
    return { relatorios: [], error: relatorioError };
  }

  // Pega os IDs dos assistidos atendidos nos relatórios para puxar
  // também os outros tratamentos que eles têm.
  const assistidoIds = [
    ...new Set(
      (relatorioRows ?? [])
        .map((row) => one(row.sessao)?.tratamento?.assistido_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];

  let tratamentoRows: AssistidoTratamentoRow[] = [];
  if (assistidoIds.length > 0) {
    const { data } = await supabase
      .from("cepzk_tratamento")
      .select(
        `assistido_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT})`,
      )
      .in("assistido_id", assistidoIds)
      .returns<AssistidoTratamentoRow[]>();
    tratamentoRows = data ?? [];
  }

  const tratamentosByAssistido = new Map<number, string[]>();
  for (const row of tratamentoRows) {
    const atendimento = one(row.atendimento);
    if (!atendimento) continue;
    const mapped = mapAtendimento(atendimento);
    const label = `${mapped.setor} — ${mapped.horario}`;
    const list = tratamentosByAssistido.get(row.assistido_id) ?? [];
    list.push(label);
    tratamentosByAssistido.set(row.assistido_id, list);
  }
  for (const [, list] of tratamentosByAssistido) {
    list.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const relatorios: AcaRelatorio[] = (relatorioRows ?? []).map((row) => {
    const sessao = one(row.sessao);
    const tratamento = sessao?.tratamento ?? null;
    const procedimentos = (sessao?.procedimentos ?? [])
      .map((p) => one(p.procedimento)?.nome)
      .filter((nome): nome is string => Boolean(nome))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));

    return {
      id: row.id,
      sessaoId: row.sessao_id,
      data: sessao?.data ?? new Date().toISOString(),
      assistidoNome: tratamento?.assistido?.nome_completo ?? "—",
      assistidoId: tratamento?.assistido_id ?? 0,
      tratamentos: tratamentosByAssistido.get(tratamento?.assistido_id ?? 0) ?? [],
      procedimentos,
      dirigenteNome: volunteerName(row.dirigente),
      ponteNome: volunteerName(row.ponte),
      obs: row.obs,
    };
  });

  return { relatorios, error: null };
}
