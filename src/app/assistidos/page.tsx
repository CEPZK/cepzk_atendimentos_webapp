import type { Metadata } from "next";
import Link from "next/link";
import { requireAssistidoAccess } from "@/lib/assistido-access";
import {
  ATENDIMENTO_SELECT,
  mapAtendimento,
  one,
  type AtendimentoRow,
} from "@/lib/atendimento";
import {
  buildAssistidoList,
  isDesobsessaoInfantil,
  type Assistido,
} from "@/lib/assistido";
import { ArrowLeftIcon } from "@/app/icons";
import { AssistidosList } from "./assistidos-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assistidos",
};

interface TreatmentStateRow {
  assistido_id: number;
  estado: string;
  atendimento_id: number | null;
  atendimento: AtendimentoRow | AtendimentoRow[] | null;
  assistido: { id: number; nome_completo: string } | null;
}

export default async function AssistidosPage() {
  const access = await requireAssistidoAccess();
  const { supabase, isFull } = access;

  // Filtra fora da lista os atendimentos da Desobsessão Infantil: esses
  // voluntários têm seus próprios cards e não devem aparecer aqui.
  const nonDIAtendimentos = access.atendimentos.filter(
    (at) => !isDesobsessaoInfantil(at.setor),
  );
  const visibleAtendimentoIds = nonDIAtendimentos.map((at) => at.id);

  // Para voluntários exclusivamente da Desobsessão Infantil, sem nenhum
  // outro atendimento, a lista geral fica vazia (os cards próprios na
  // página inicial são a entrada correta). Não redirecionamos, pois o
  // acesso ao detalhe do assistido precisa funcionar quando eles voltam
  // pela seta do navegador.
  const hasAnyVisible = isFull || visibleAtendimentoIds.length > 0;

  // Quem é do Atendimento Fraterno (ou admin) vê todo mundo; os outros
  // times veem apenas quem tem tratamento no atendimento da sua escala,
  // excluindo a Desobsessão Infantil.
  const treatmentsQuery = supabase
    .from("cepzk_tratamento")
    .select(
      `assistido_id, estado, atendimento_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT}), assistido:cepzk_assistido (id, nome_completo)`,
    );

  const [everyone, treatments] = await Promise.all([
    isFull
      ? supabase
          .from("cepzk_assistido")
          .select("id, nome_completo")
          .returns<Assistido[]>()
      : Promise.resolve({ data: [] as Assistido[], error: null }),
    !hasAnyVisible
      ? Promise.resolve({ data: [] as TreatmentStateRow[], error: null })
      : (isFull
          ? treatmentsQuery
          : treatmentsQuery.in("atendimento_id", visibleAtendimentoIds)
        ).returns<TreatmentStateRow[]>(),
  ]);

  const error = everyone.error ?? treatments.error;

  // Manda o tratamento mais pendente. Fora do Atendimento Fraterno a
  // consulta acima só trouxe os tratamentos da escala do voluntário,
  // excluindo Desobsessão Infantil, então o assistido só cai para o fim
  // da lista quando tudo o que é dele já recebeu alta. Para os admins /
  // Atendimento Fraterno, também excluímos da lista os tratamentos da
  // Desobsessão Infantil para não confundir os voluntários que atendem
  // outras equipes.
  const treatmentRows = (treatments.data ?? []).filter((row) => {
    if (isFull) {
      const at = one(row.atendimento);
      const mapped = at ? mapAtendimento(at) : null;
      if (mapped && isDesobsessaoInfantil(mapped.setor)) return false;
    }
    return true;
  });

  const assistidos = buildAssistidoList(
    everyone.data ?? [],
    treatmentRows.map((row) => ({
      assistido_id: row.assistido_id,
      estado: row.estado,
      nome_completo: row.assistido?.nome_completo,
    })),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-teal-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Início
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Lista de Assistidos
      </h1>

      {error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os assistidos ({error.code}: {error.message}
          ).
        </p>
      ) : (
        <AssistidosList assistidos={assistidos} canRegister={isFull} />
      )}
    </main>
  );
}
