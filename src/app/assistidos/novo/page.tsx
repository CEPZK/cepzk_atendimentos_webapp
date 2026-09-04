import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/current-volunteer";
import { type CatalogItem } from "@/lib/assistido";
import {
  mapAtendimento,
  sortAtendimentos,
  ATENDIMENTO_SELECT,
  type AtendimentoRow,
} from "@/lib/atendimento";
import { ArrowLeftIcon } from "@/app/icons";
import { NewAssistidoFlow } from "./new-assistido-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cadastrar assistido",
};

export default async function NewAssistidoPage() {
  const { supabase } = await requireAdmin();

  const [{ data: atendimentoRows }, { data: distonias }, { data: queixas }] =
    await Promise.all([
      // Precedência 0 é a entrevista do Atendimento Fraterno, que não é um
      // tratamento — o cadastro só oferece os atendimentos tratáveis.
      supabase
        .from("cepzk_atendimento")
        .select(ATENDIMENTO_SELECT)
        .gt("precedencia", 0)
        .returns<AtendimentoRow[]>(),
      supabase
        .from("aca_distonia")
        .select("id, nome")
        .order("id")
        .returns<CatalogItem[]>(),
      supabase
        .from("aca_queixa")
        .select("id, nome")
        .order("nome")
        .returns<CatalogItem[]>(),
    ]);

  const atendimentos = sortAtendimentos(
    (atendimentoRows ?? []).map(mapAtendimento),
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href="/assistidos"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-sky-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Assistidos
      </Link>

      <NewAssistidoFlow
        atendimentos={atendimentos}
        distonias={distonias ?? []}
        queixas={queixas ?? []}
      />
    </main>
  );
}
