import type { Metadata } from "next";
import Link from "next/link";
import { requireSector } from "@/lib/current-volunteer";
import { ACA_SECTOR, isAcolherComAmor } from "@/lib/assistido";
import {
  mapAtendimento,
  one,
  ATENDIMENTO_SELECT,
  type AtendimentoRow,
} from "@/lib/atendimento";
import {
  CALENDAR_OCCURRENCES,
  dayKey,
  parseHorario,
  upcomingOccurrences,
} from "@/lib/aca-agenda";
import { ArrowLeftIcon } from "@/app/icons";
import {
  ReportFlow,
  type ReportCalendarDay,
  type ReportVolunteer,
} from "./report-flow";
import { fullName, type Volunteer } from "@/lib/volunteer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Registrar Relatório — Acolher com Amor",
};

interface SessionRow {
  id: number;
  data: string;
  relatorio: { id: number } | { id: number }[] | null;
  tratamento:
    | {
        id: number;
        atendimento_id: number | null;
        assistido: { id: number; nome_completo: string } | null;
      }
    | {
        id: number;
        atendimento_id: number | null;
        assistido: { id: number; nome_completo: string } | null;
      }[]
    | null;
}

/**
 * Tela de "Registrar Relatório": o voluntário escolhe o dia no calendário
 * do Acolher com Amor e, em seguida, preenche ponte/dirigente/observações
 * de cada assistido agendado naquele dia.
 */
export default async function NovoRelatorioPage() {
  const { supabase } = await requireSector(ACA_SECTOR);

  const { data: atendimentoRows } = await supabase
    .from("cepzk_atendimento")
    .select(ATENDIMENTO_SELECT)
    .returns<AtendimentoRow[]>();

  const atendimentos = (atendimentoRows ?? [])
    .map(mapAtendimento)
    .filter((atendimento) => isAcolherComAmor(atendimento.setor));

  // Próximas ocorrências do Acolher com Amor: o calendário mostra os
  // mesmos dias do agendamento de sessões.
  const occurrences = atendimentos
    .flatMap((atendimento) => {
      const schedule = parseHorario(atendimento.horario);
      if (!schedule) return [];
      return upcomingOccurrences(schedule, CALENDAR_OCCURRENCES).map(
        (date) => ({ atendimento, date }),
      );
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let sessionRows: SessionRow[] = [];
  if (occurrences.length > 0) {
    const from = occurrences[0].date;
    const to = new Date(
      occurrences[occurrences.length - 1].date.getTime() + 86_400_000,
    );

    const { data } = await supabase
      .from("aca_sessao")
      .select(
        `id, data, relatorio:aca_relatorio (id), tratamento:cepzk_tratamento (id, atendimento_id, assistido:cepzk_assistido (id, nome_completo))`,
      )
      .gte("data", from.toISOString())
      .lte("data", to.toISOString())
      .returns<SessionRow[]>();
    sessionRows = data ?? [];
  }

  const acaAtendimentoIds = new Set(atendimentos.map((item) => item.id));

  // Um dia por data do calendário: cada ocorrência vira um item
  // (mesmo quando não há assistidos agendados, o dia continua
  // disponível para abrir o diálogo de relatório).
  const daysByKey = new Map<string, ReportCalendarDay>();
  for (const { date } of occurrences) {
    const key = dayKey(date);
    if (!daysByKey.has(key)) {
      daysByKey.set(key, { iso: date.toISOString(), assistidos: [] });
    }
  }

  for (const row of sessionRows) {
    const tratamento = one(row.tratamento);
    if (!tratamento || !acaAtendimentoIds.has(tratamento.atendimento_id ?? -1)) {
      continue;
    }
    const assistido = tratamento.assistido;
    if (!assistido) continue;

    const day = daysByKey.get(dayKey(row.data));
    if (!day) continue;
    if (
      day.assistidos.some(
        (item) => item.tratamentoId === tratamento.id,
      )
    ) {
      continue;
    }
    day.assistidos.push({
      tratamentoId: tratamento.id,
      sessaoId: row.id,
      nome: assistido.nome_completo,
      hasRelatorio: Boolean(one(row.relatorio)),
    });
  }

  const days = [...daysByKey.values()]
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map((day) => ({
      ...day,
      assistidos: [...day.assistidos].sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR"),
      ),
    }));

  // Voluntários escalados no Acolher com Amor: opções dos comboboxes
  // de dirigente e ponte.
  const { data: escalaRows } = await supabase
    .from("cepzk_escala")
    .select(
      `voluntario:cepzk_voluntario (id, nome, sobrenome), atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT})`,
    )
    .returns<
      {
        voluntario:
          | { id: string; nome: string; sobrenome: string | null }
          | { id: string; nome: string; sobrenome: string | null }[]
          | null;
        atendimento: AtendimentoRow | AtendimentoRow[] | null;
      }[]
    >();

  const volunteers: ReportVolunteer[] = (() => {
    const seen = new Map<string, ReportVolunteer>();
    for (const row of escalaRows ?? []) {
      const atendimentoRow = one(row.atendimento);
      const atendimento = atendimentoRow ? mapAtendimento(atendimentoRow) : null;
      if (!atendimento || !isAcolherComAmor(atendimento.setor)) continue;
      const voluntario = one(row.voluntario);
      if (!voluntario) continue;
      if (seen.has(voluntario.id)) continue;
      const nome =
        fullName(voluntario as Pick<Volunteer, "nome" | "sobrenome">) ||
        voluntario.nome;
      seen.set(voluntario.id, { id: voluntario.id, nome });
    }
    return [...seen.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
  })();

  const horarios =
    atendimentos.map((item) => item.horario).join(" · ") || "Acolher com Amor";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href="/acolher-com-amor/relatorios"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-sky-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Relatórios
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Registrar Relatório
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Escolha o dia no calendário ({horarios}) para registrar ponte,
        dirigente e observações dos assistidos atendidos.
      </p>

      <ReportFlow days={days} volunteers={volunteers} />
    </main>
  );
}
