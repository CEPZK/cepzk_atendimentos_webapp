import type { Metadata } from "next";
import Link from "next/link";
import { requireDepartment } from "@/lib/current-volunteer";
import { ATENDIMENTO_FRATERNO, type Assistido } from "@/lib/assistido";
import { ArrowLeftIcon } from "@/app/icons";
import { AssistidosList } from "./assistidos-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assistidos",
};

export default async function AssistidosPage() {
  const { supabase } = await requireDepartment(ATENDIMENTO_FRATERNO);

  const { data, error } = await supabase
    .from("cepzk_assistido")
    .select("id, nome_completo")
    .order("nome_completo", { ascending: true })
    .returns<Assistido[]>();

  // Postgres orders by byte value, which puts "Ângela" after "Zulmira":
  // sort with the Brazilian locale so the list reads alphabetically.
  const assistidos = (data ?? []).sort((a, b) =>
    a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
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
        <AssistidosList assistidos={assistidos} />
      )}
    </main>
  );
}
