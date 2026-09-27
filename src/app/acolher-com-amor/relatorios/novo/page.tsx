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
  addDays,
  dayKey,
  monthGrid,
} from "@/lib/aca-agenda";
import { ArrowLeftIcon } from "@/app/icons";
import {
  ReportFlow,
  type ReportCalendarDay,
  type ReportVolunteer,
} from "./report-flow";
import { reportMonth } from "@/lib/aca-relatorio";
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
export default async function NovoRelatorioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const { supabase } = await requireSector(ACA_SECTOR);

  const { data: atendimentoRows } = await supabase
    .from("cepzk_atendimento")
    .select(ATENDIMENTO_SELECT)
    .returns<AtendimentoRow[]>();

  const atendimentos = (atendimentoRows ?? [])
    .map(mapAtendimento)
    .filter((atendimento) => isAcolherComAmor(atendimento.setor));

  // Reports may refer to any date, not just the upcoming schedule.
  // Fetch only the visible grid, including the neighbouring-month cells.
  const month = reportMonth((await searchParams).mes);
  const cells = monthGrid(month.year, month.month).weeks.flat();
  const from = new Date(`${cells[0].key}T00:00:00-03:00`);
  const to = addDays(new Date(`${cells[cells.length - 1].key}T00:00:00-03:00`), 1);

  const { data: sessionRows, error: sessionError } = await supabase
    .from("aca_sessao")
    .select(
      `id, data, relatorio:aca_relatorio (id), tratamento:cepzk_tratamento (id, atendimento_id, assistido:cepzk_assistido (id, nome_completo))`,
    )
    .gte("data", from.toISOString())
    .lt("data", to.toISOString())
    .order("data")
    .returns<SessionRow[]>();

  const acaAtendimentoIds = new Set(atendimentos.map((item) => item.id));
  const daysByKey = new Map<string, ReportCalendarDay>(
    cells.map((cell) => [cell.key, {
      iso: new Date(`${cell.key}T00:00:00-03:00`).toISOString(),
      assistidos: [],
    }]),
  );

  for (const row of sessionRows ?? []) {
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
    if (day.assistidos.length === 0) day.iso = row.data;
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

      {sessionError ? (
        <p role="alert" className="mt-6 text-sm text-red-700">
          Não foi possível carregar as sessões. Tente novamente.
        </p>
      ) : (
        <ReportFlow
          key={`${month.year}-${month.month}`}
          month={month}
          days={days}
          volunteers={volunteers}
        />
      )}
    </main>
  );
}
