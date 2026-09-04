import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase, requireAdmin } from "@/lib/current-volunteer";
import type { Volunteer } from "@/lib/volunteer";
import { ArrowLeftIcon } from "@/app/icons";
import { VolunteersList } from "./volunteers-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Voluntários",
};

export default async function VolunteersPage() {
  // Guarda e consulta em paralelo: em série, cada tela custa duas idas
  // ao Supabase antes de aparecer.
  const supabase = await getSupabase();
  const [, { data, error }] = await Promise.all([
    requireAdmin(),
    supabase
      .from("cepzk_voluntario")
      .select("id, nome, sobrenome, email, telefone, papel")
      .order("nome", { ascending: true })
      .returns<Volunteer[]>(),
  ]);

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
        Gerenciar Voluntários
      </h1>

      {error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os voluntários ({error.code}: {error.message}).
        </p>
      ) : (
        <VolunteersList volunteers={data ?? []} />
      )}
    </main>
  );
}
