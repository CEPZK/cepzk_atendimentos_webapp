import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAssistidoAccess } from "@/lib/assistido-access";
import {
  isAcolherComAmor,
  type CatalogItem,
} from "@/lib/assistido";
import {
  mapAtendimento,
  one,
  ATENDIMENTO_SELECT,
  type AtendimentoRow,
} from "@/lib/atendimento";
import { todayKey } from "@/lib/aca-agenda";
import { ArrowLeftIcon } from "@/app/icons";
import {
  TreatmentSessionsEditor,
  type EditableSession,
} from "./treatment-sessions-editor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ treatmentId: string }>;
}

export const metadata: Metadata = {
  title: "Sessões — Acolher com Amor",
};

interface TreatmentRow {
  id: number;
  estado: string;
  obs: string | null;
  assistido_id: number;
  atendimento_id: number | null;
  atendimento: AtendimentoRow | AtendimentoRow[] | null;
  assistido: { nome_completo: string } | { nome_completo: string }[] | null;
  aca:
    | { distonia: { nome: string } | { nome: string }[] | null }
    | { distonia: { nome: string } | { nome: string }[] | null }[]
    | null;
  queixas: { queixa: { nome: string } | { nome: string }[] | null }[] | null;
}

interface SessionRow {
  id: number;
  data: string;
  procedimentos: { procedimento_id: number }[] | null;
}

/**
 * The treatment of one assistido as reached from the sessions calendar:
 * the same screen as the treatment start (the sessions and their
 * procedures), but loaded with what is already scheduled and editable —
 * procedures can be changed, removed and added.
 */
export default async function AcaTreatmentSessionsPage({
  params,
}: PageProps) {
  const { treatmentId } = await params;
  const access = await requireAssistidoAccess();
  const { supabase } = access;

  const { data: treatment } = await supabase
    .from("cepzk_tratamento")
    .select(
      `id, estado, obs, assistido_id, atendimento_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT}), assistido:cepzk_assistido (nome_completo), aca:aca_tratamento (distonia:aca_distonia (nome)), queixas:aca_tratamento_queixa (queixa:aca_queixa (nome))`,
    )
    .eq("id", treatmentId)
    .maybeSingle<TreatmentRow>();

  if (!treatment) {
    notFound();
  }

  const atendimentoRow = one(treatment.atendimento);
  const atendimento = atendimentoRow ? mapAtendimento(atendimentoRow) : null;

  // A tela edita as sessões de um tratamento do Acolher com Amor que o
  // voluntário conduz; qualquer outro caso volta para o calendário.
  if (
    !atendimento ||
    !isAcolherComAmor(atendimento.setor) ||
    !access.canManageTreatment(treatment.atendimento_id)
  ) {
    redirect("/acolher-com-amor/calendario");
  }

  const [{ data: sessionRows }, { data: procedimentos }] = await Promise.all([
    supabase
      .from("aca_sessao")
      .select("id, data, procedimentos:aca_sessao_procedimento (procedimento_id)")
      .eq("tratamento_id", treatment.id)
      .order("data")
      .returns<SessionRow[]>(),
    supabase
      .from("aca_procedimento")
      .select("id, nome")
      .order("nome")
      .returns<CatalogItem[]>(),
  ]);

  // Sem sessões não há o que editar aqui: o tratamento ainda não foi
  // agendado (o lugar disso é a tela de iniciar tratamento).
  if (!sessionRows || sessionRows.length === 0) {
    redirect("/acolher-com-amor/calendario");
  }

  const sessions: EditableSession[] = (sessionRows ?? []).map((row) => ({
    sessaoId: row.id,
    data: row.data,
    procedimentoIds: (row.procedimentos ?? []).map(
      (item) => item.procedimento_id,
    ),
  }));

  const assistidoNome = one(treatment.assistido)?.nome_completo ?? "Assistido";

  // A sessão do dia corrente é destacada na tela. O dia é o da casa, não o
  // do fuso do servidor, e vem calculado daqui (a página é dinâmica) para
  // que o servidor e o browser destaquem sempre a mesma sessão.
  const today = todayKey();

  const treatmentData = {
    distonia: one(one(treatment.aca)?.distonia)?.nome ?? null,
    queixas: (treatment.queixas ?? [])
      .map((item) => one(item.queixa)?.nome)
      .filter((nome): nome is string => Boolean(nome))
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    obs: treatment.obs,
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href="/acolher-com-amor/calendario"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-teal-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Calendário
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        {assistidoNome}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {atendimento.setor} · {atendimento.horario}
      </p>

      <TreatmentSessionsEditor
        treatmentId={treatment.id}
        assistidoNome={assistidoNome}
        sessions={sessions}
        treatment={treatmentData}
        procedimentos={procedimentos ?? []}
        today={today}
      />
    </main>
  );
}
