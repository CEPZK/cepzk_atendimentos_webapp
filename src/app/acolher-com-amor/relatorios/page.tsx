import type { Metadata } from "next";
import Link from "next/link";
import { requireSector } from "@/lib/current-volunteer";
import { ACA_SECTOR } from "@/lib/assistido";
import { ArrowLeftIcon, PlusIcon } from "@/app/icons";
import { ReportsList } from "./reports-list";
import { loadRelatorios } from "./queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Relatório de Atendimentos — Acolher com Amor",
};

export default async function RelatoriosPage() {
  // Só o time do Acolher com Amor (e o admin) acompanha os relatórios.
  const { supabase } = await requireSector(ACA_SECTOR);

  const { relatorios, error } = await loadRelatorios(supabase);

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
        Relatório de Atendimentos
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Relatórios das sessões do Acolher com Amor, dos mais recentes aos
        mais antigos.
      </p>

      <Link
        href="/acolher-com-amor/relatorios/novo"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2"
      >
        <PlusIcon className="h-5 w-5" />
        Registrar Relatório
      </Link>

      {error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os relatórios ({error.code}: {error.message}
          ).
        </p>
      ) : (
        <ReportsList relatorios={relatorios} />
      )}
    </main>
  );
}
