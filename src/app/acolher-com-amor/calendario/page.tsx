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
import { CalendarScreen, type CalendarDay } from "./calendar-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendário — Acolher com Amor",
};

interface SessionRow {
  data: string;
  tratamento:
    | {
        id: number;
        atendimento_id: number | null;
        assistido:
          | { id: number; nome_completo: string }
          | { id: number; nome_completo: string }[]
          | null;
      }
    | {
        id: number;
        atendimento_id: number | null;
        assistido:
          | { id: number; nome_completo: string }
          | { id: number; nome_completo: string }[]
          | null;
      }[]
    | null;
}

/**
 * The sessions calendar of the Acolher com Amor: the days the atendimento
 * happens, each one carrying the assistidos booked on it. Clicking a day
 * opens the list, and clicking an assistido opens their treatment.
 */
export default async function AcaCalendarPage() {
  // Só o time do Acolher com Amor (e o admin) acompanha a agenda.
  const { supabase } = await requireSector(ACA_SECTOR);

  const { data: atendimentoRows } = await supabase
    .from("cepzk_atendimento")
    .select(ATENDIMENTO_SELECT)
    .returns<AtendimentoRow[]>();

  const atendimentos = (atendimentoRows ?? [])
    .map(mapAtendimento)
    .filter((atendimento) => isAcolherComAmor(atendimento.setor));

  // Cada atendimento do ACA tem seu próprio dia e hora: a agenda é a
  // união das ocorrências de todos eles.
  const occurrences = atendimentos
    .flatMap((atendimento) => {
      const schedule = parseHorario(atendimento.horario);
      if (!schedule) return [];
      return upcomingOccurrences(schedule, CALENDAR_OCCURRENCES).map(
        (date) => ({ atendimento, date }),
      );
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Quem está agendado em cada dia, de qualquer atendimento do ACA.
  let sessionRows: SessionRow[] = [];
  if (occurrences.length > 0) {
    const from = occurrences[0].date;
    const to = new Date(
      occurrences[occurrences.length - 1].date.getTime() + 86_400_000,
    );

    const { data } = await supabase
      .from("aca_sessao")
      .select(
        "data, tratamento:cepzk_tratamento (id, atendimento_id, assistido:cepzk_assistido (id, nome_completo))",
      )
      .gte("data", from.toISOString())
      .lte("data", to.toISOString())
      .returns<SessionRow[]>();
    sessionRows = data ?? [];
  }

  const acaAtendimentoIds = new Set(atendimentos.map((item) => item.id));

  // Um dia por data do calendário; o horário exibido é o da ocorrência.
  const daysByKey = new Map<string, CalendarDay>();
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
    const assistido = one(tratamento.assistido);
    if (!assistido) continue;

    const day = daysByKey.get(dayKey(row.data));
    if (!day) continue;
    if (day.assistidos.some((item) => item.treatmentId === tratamento.id)) {
      continue;
    }
    day.assistidos.push({
      treatmentId: tratamento.id,
      nome: assistido.nome_completo,
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

  const horarios =
    atendimentos.map((item) => item.horario).join(" · ") || "Acolher com Amor";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-sky-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Início
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Calendário do Acolher com Amor
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        As sessões de {horarios}. Clique em um dia para ver os assistidos
        agendados.
      </p>

      <CalendarScreen days={days} horarios={horarios} />
    </main>
  );
}
