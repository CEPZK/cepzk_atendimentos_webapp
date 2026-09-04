import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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

  // A lista geral é dos admins: as equipes veem seus assistidos pelas
  // telas próprias, e o Atendimento Fraterno, pela tela de cadastro.
  if (!access.isFull) {
    redirect("/");
  }

  const { supabase } = access;

  const [everyone, treatments] = await Promise.all([
    supabase
      .from("cepzk_assistido")
      .select("id, nome_completo")
      .returns<Assistido[]>(),
    supabase
      .from("cepzk_tratamento")
      .select(
        `assistido_id, estado, atendimento_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT}), assistido:cepzk_assistido (id, nome_completo)`,
      )
      .returns<TreatmentStateRow[]>(),
  ]);

  const error = everyone.error ?? treatments.error;

  // Os tratamentos da Desobsessão Infantil ficam fora da lista geral:
  // os voluntários dessas equipes usam os cards próprios.
  const treatmentRows = (treatments.data ?? []).filter((row) => {
    const at = one(row.atendimento);
    const mapped = at ? mapAtendimento(at) : null;
    if (mapped && isDesobsessaoInfantil(mapped.setor)) return false;
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
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-sky-700"
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
        <AssistidosList assistidos={assistidos} canRegister={access.isFull} />
      )}
    </main>
  );
}
