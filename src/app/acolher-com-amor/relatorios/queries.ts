import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapAtendimento,
  one,
  ATENDIMENTO_SELECT,
  type AtendimentoRow,
} from "@/lib/atendimento";
import type { AcaRelatorio } from "@/lib/aca-relatorio";

/** PostgREST devolve a linha embutida como objeto ou como array de um. */
type Embedded<T> = T | T[] | null;

interface VoluntarioRow {
  id: string;
  nome: string;
  sobrenome: string | null;
}

/** O tratamento da sessão: o assistido e o que o cadastro registrou dele. */
interface TratamentoRow {
  id: number;
  assistido_id: number;
  obs: string | null;
  assistido: Embedded<{ id: number; nome_completo: string }>;
  aca: Embedded<{ distonia: Embedded<{ nome: string }> }>;
  queixas: { queixa: Embedded<{ nome: string }> }[] | null;
}

interface SessaoRow {
  id: number;
  data: string;
  tratamento: Embedded<TratamentoRow>;
  procedimentos: { procedimento: Embedded<{ nome: string }> }[] | null;
}

interface RelatorioRow {
  id: number;
  sessao_id: number;
  obs: string | null;
  sessao: Embedded<SessaoRow>;
  dirigente: Embedded<VoluntarioRow>;
  ponte: Embedded<VoluntarioRow>;
}

interface AssistidoTratamentoRow {
  assistido_id: number;
  atendimento: Embedded<AtendimentoRow>;
}

/**
 * O relatório inteiro: a sessão (data e procedimentos), o dirigente, o
 * ponte, as observações e — pelo tratamento da sessão — o assistido com
 * a distonia, as queixas e as observações do cadastro.
 *
 * Usado tanto pela lista quanto pela tela de detalhe, para que as duas
 * leiam exatamente os mesmos dados.
 */
const RELATORIO_SELECT = `id, sessao_id, obs,
  sessao:aca_sessao (
    id, data,
    tratamento:cepzk_tratamento (
      id, assistido_id, obs,
      assistido:cepzk_assistido (id, nome_completo),
      aca:aca_tratamento (distonia:aca_distonia (nome)),
      queixas:aca_tratamento_queixa (queixa:aca_queixa (nome))
    ),
    procedimentos:aca_sessao_procedimento (procedimento:aca_procedimento (nome))
  ),
  dirigente:cepzk_voluntario!aca_relatorio_dirigente_id_fkey (id, nome, sobrenome),
  ponte:cepzk_voluntario!aca_relatorio_ponte_id_fkey (id, nome, sobrenome)`;

function volunteerName(v: Embedded<VoluntarioRow>): string {
  const r = one(v);
  if (!r) return "—";
  return [r.nome, r.sobrenome].filter(Boolean).join(" ") || "—";
}

/**
 * Os tratamentos de cada assistido — lidos nas telas do Acolher com Amor
 * como "assistências" — no formato "Setor — Horário", em ordem alfabética.
 */
async function loadAssistencias(
  supabase: SupabaseClient,
  assistidoIds: number[],
): Promise<Map<number, string[]>> {
  const byAssistido = new Map<number, string[]>();
  if (assistidoIds.length === 0) return byAssistido;

  const { data } = await supabase
    .from("cepzk_tratamento")
    .select(
      `assistido_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT})`,
    )
    .in("assistido_id", assistidoIds)
    .returns<AssistidoTratamentoRow[]>();

  for (const row of data ?? []) {
    const atendimento = one(row.atendimento);
    if (!atendimento) continue;
    const mapped = mapAtendimento(atendimento);
    const list = byAssistido.get(row.assistido_id) ?? [];
    list.push(`${mapped.setor} — ${mapped.horario}`);
    byAssistido.set(row.assistido_id, list);
  }

  for (const [, list] of byAssistido) {
    list.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  return byAssistido;
}

function mapRelatorio(
  row: RelatorioRow,
  assistencias: Map<number, string[]>,
): AcaRelatorio {
  const sessao = one(row.sessao);
  const tratamento = one(sessao?.tratamento);
  const assistidoId = tratamento?.assistido_id ?? 0;
  const procedimentos = (sessao?.procedimentos ?? [])
    .map((p) => one(p.procedimento)?.nome)
    .filter((nome): nome is string => Boolean(nome))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    id: row.id,
    sessaoId: row.sessao_id,
    data: sessao?.data ?? new Date().toISOString(),
    assistidoNome: one(tratamento?.assistido)?.nome_completo ?? "—",
    assistidoId,
    tratamentos: assistencias.get(assistidoId) ?? [],
    distonia: one(one(tratamento?.aca)?.distonia)?.nome ?? null,
    queixas: (tratamento?.queixas ?? [])
      .map((item) => one(item.queixa)?.nome)
      .filter((nome): nome is string => Boolean(nome))
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    obsCadastro: tratamento?.obs ?? null,
    procedimentos,
    dirigenteNome: volunteerName(row.dirigente),
    ponteNome: volunteerName(row.ponte),
    obs: row.obs,
  };
}

/**
 * Carrega todos os relatórios do Acolher com Amor, já com o nome do
 * assistido, os procedimentos da sessão, o nome do dirigente e o nome do
 * ponte, e a lista de assistências do assistido (todos os setores).
 *
 * Ordenado pela data da sessão, da mais nova para a mais antiga.
 */
export async function loadRelatorios(
  supabase: SupabaseClient,
): Promise<{ relatorios: AcaRelatorio[]; error: { code: string; message: string } | null }> {
  const { data: relatorioRows, error: relatorioError } = await supabase
    .from("aca_relatorio")
    .select(RELATORIO_SELECT)
    .order("sessao(data)", { ascending: false })
    .returns<RelatorioRow[]>();

  if (relatorioError) {
    return { relatorios: [], error: relatorioError };
  }

  // Pega os IDs dos assistidos atendidos nos relatórios para puxar
  // também as outras assistências que eles têm.
  const assistidoIds = [
    ...new Set(
      (relatorioRows ?? [])
        .map((row) => one(one(row.sessao)?.tratamento)?.assistido_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];

  const assistencias = await loadAssistencias(supabase, assistidoIds);

  const relatorios = (relatorioRows ?? []).map((row) =>
    mapRelatorio(row, assistencias),
  );

  return { relatorios, error: null };
}

/**
 * Carrega um único relatório pelo id — a tela inteira que a lista abre.
 *
 * `relatorio` vem `null` quando o id não existe (a tela responde 404) e
 * `error` quando a consulta falhou.
 */
export async function loadRelatorio(
  supabase: SupabaseClient,
  id: string,
): Promise<{ relatorio: AcaRelatorio | null; error: { code: string; message: string } | null }> {
  const { data: row, error } = await supabase
    .from("aca_relatorio")
    .select(RELATORIO_SELECT)
    .eq("id", id)
    .maybeSingle<RelatorioRow>();

  if (error) {
    return { relatorio: null, error };
  }
  if (!row) {
    return { relatorio: null, error: null };
  }

  const assistidoId = one(one(row.sessao)?.tratamento)?.assistido_id;
  const assistencias = await loadAssistencias(
    supabase,
    typeof assistidoId === "number" ? [assistidoId] : [],
  );

  return { relatorio: mapRelatorio(row, assistencias), error: null };
}
