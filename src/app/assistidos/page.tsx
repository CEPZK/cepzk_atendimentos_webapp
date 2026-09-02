import type { Metadata } from "next";
import Link from "next/link";
import { requireAssistidoAccess } from "@/lib/assistido-access";
import { buildAssistidoList, type Assistido } from "@/lib/assistido";
import { ArrowLeftIcon } from "@/app/icons";
import { AssistidosList } from "./assistidos-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assistidos",
};

interface TreatmentStateRow {
  assistido_id: number;
  estado: string;
  assistido: { id: number; nome_completo: string } | null;
}

export default async function AssistidosPage() {
  const { supabase, isFull, atendimentoIds } = await requireAssistidoAccess();

  // Quem é do Atendimento Fraterno (ou admin) vê todo mundo; os outros
  // times veem apenas quem tem tratamento no atendimento da sua escala.
  const treatmentsQuery = supabase
    .from("cepzk_tratamento")
    .select(
      "assistido_id, estado, assistido:cepzk_assistido (id, nome_completo)",
    );

  const [everyone, treatments] = await Promise.all([
    isFull
      ? supabase
          .from("cepzk_assistido")
          .select("id, nome_completo")
          .returns<Assistido[]>()
      : Promise.resolve({ data: [] as Assistido[], error: null }),
    (isFull
      ? treatmentsQuery
      : treatmentsQuery.in("atendimento_id", atendimentoIds)
    ).returns<TreatmentStateRow[]>(),
  ]);

  const error = everyone.error ?? treatments.error;

  // Para quem vê tudo, manda o tratamento mais pendente. Para os demais
  // times, a consulta acima só trouxe os tratamentos da sua escala: se um
  // deles já está em alta, o assistido está encerrado para eles e desce
  // para o fim da lista.
  const assistidos = buildAssistidoList(
    everyone.data ?? [],
    (treatments.data ?? []).map((row) => ({
      assistido_id: row.assistido_id,
      estado: row.estado,
      nome_completo: row.assistido?.nome_completo,
    })),
    isFull ? "mais-pendente" : "mais-avancado",
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
