import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAssistidoAccess } from "@/lib/assistido-access";
import {
  ESTADO_PENDENTE,
  isAcolherComAmor,
  isState,
  type CatalogItem,
} from "@/lib/assistido";
import {
  mapAtendimento,
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
import { ScheduleFlow, type CalendarDay } from "./schedule-flow";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; treatmentId: string }>;
  searchParams: Promise<{ from?: string }>;
}

export const metadata: Metadata = {
  title: "Agendar tratamento",
};

/** PostgREST returns embedded rows as an object or as a single-item array. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface TreatmentRow {
  id: number;
  estado: string;
  assistido_id: number;
  atendimento_id: number | null;
  atendimento: AtendimentoRow | AtendimentoRow[] | null;
  assistido: { nome_completo: string } | { nome_completo: string }[] | null;
}

interface SessionRow {
  data: string;
  tratamento:
    | {
        atendimento_id: number | null;
        assistido: { nome_completo: string } | { nome_completo: string }[] | null;
      }
    | {
        atendimento_id: number | null;
        assistido: { nome_completo: string } | { nome_completo: string }[] | null;
      }[]
    | null;
}

/**
 * Agenda of the Acolher com Amor: the days the atendimento happens, each
 * one with the assistidos already booked, and then the three sessions of
 * the treatment being started.
 */
export default async function AgendarPage({
  params,
  searchParams,
}: PageProps) {
  const { id, treatmentId } = await params;
  // De onde o voluntário veio (a Lista de Espera, por exemplo): o voltar
  // e o fim do agendamento devolvem para a mesma lista.
  const { from } = await searchParams;
  const backQuery = from ? `?from=${encodeURIComponent(from)}` : "";
  const access = await requireAssistidoAccess();
  const { supabase } = access;

  const { data: treatment } = await supabase
    .from("cepzk_tratamento")
    .select(
      `id, estado, assistido_id, atendimento_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT}), assistido:cepzk_assistido (nome_completo)`,
    )
    .eq("id", treatmentId)
    .maybeSingle<TreatmentRow>();

  if (!treatment || String(treatment.assistido_id) !== String(id)) {
    notFound();
  }

  const atendimentoRow = one(treatment.atendimento);
  const atendimento = atendimentoRow ? mapAtendimento(atendimentoRow) : null;

  // A tela é do time que conduz o tratamento, e só do Acolher com Amor
  // ainda pendente: qualquer outro caso volta para o assistido.
  if (
    !atendimento ||
    !isAcolherComAmor(atendimento.setor) ||
    !isState(treatment.estado, ESTADO_PENDENTE) ||
    !access.canManageTreatment(treatment.atendimento_id)
  ) {
    redirect(`/assistidos/${id}${backQuery}`);
  }

  const schedule = parseHorario(atendimento.horario);
  const occurrences = schedule
    ? upcomingOccurrences(schedule, CALENDAR_OCCURRENCES)
    : [];

  // Quem já está agendado em cada dia do mesmo atendimento.
  const [{ data: sessionRows }, { data: procedimentos }] = await Promise.all([
    occurrences.length > 0
      ? supabase
          .from("aca_sessao")
          .select(
            "data, tratamento:cepzk_tratamento (atendimento_id, assistido:cepzk_assistido (nome_completo))",
          )
          .gte("data", occurrences[0].toISOString())
          .lte(
            "data",
            new Date(
              occurrences[occurrences.length - 1].getTime() + 86_400_000,
            ).toISOString(),
          )
          .returns<SessionRow[]>()
      : Promise.resolve({ data: [] as SessionRow[] }),
    supabase
      .from("aca_procedimento")
      .select("id, nome")
      .order("nome")
      .returns<CatalogItem[]>(),
  ]);

  const booked = new Map<string, string[]>();
  for (const row of sessionRows ?? []) {
    const tratamento = one(row.tratamento);
    if (!tratamento || tratamento.atendimento_id !== treatment.atendimento_id) {
      continue;
    }
    const nome = one(tratamento.assistido)?.nome_completo;
    if (!nome) continue;
    const key = dayKey(row.data);
    const names = booked.get(key) ?? [];
    if (!names.includes(nome)) names.push(nome);
    booked.set(key, names);
  }

  const days: CalendarDay[] = occurrences.map((date) => ({
    iso: date.toISOString(),
    assistidos: (booked.get(dayKey(date)) ?? []).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    ),
  }));

  const assistidoNome = one(treatment.assistido)?.nome_completo ?? "Assistido";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href={`/assistidos/${id}${backQuery}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-teal-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {assistidoNome}
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Iniciar tratamento
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {atendimento.setor} · {atendimento.horario}
      </p>

      {schedule ? (
        <ScheduleFlow
          assistidoId={Number(id)}
          backQuery={backQuery}
          treatmentId={treatment.id}
          assistidoNome={assistidoNome}
          horario={atendimento.horario}
          days={days}
          procedimentos={procedimentos ?? []}
        />
      ) : (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Não foi possível ler o dia e a hora do atendimento
          {` "${atendimento.horario}"`}. Ajuste o horário no cadastro para algo
          como “Sábado 9h30”.
        </p>
      )}
    </main>
  );
}
