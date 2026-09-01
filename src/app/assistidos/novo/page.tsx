import type { Metadata } from "next";
import Link from "next/link";
import { requireDepartment } from "@/lib/current-volunteer";
import {
  ATENDIMENTO_FRATERNO,
  type CatalogItem,
  type SectorItem,
} from "@/lib/assistido";
import { ArrowLeftIcon } from "@/app/icons";
import { NewAssistidoFlow } from "./new-assistido-flow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cadastrar assistido",
};

interface SectorRow {
  id: number;
  nome: string;
  departamento: { nome: string } | { nome: string }[] | null;
}

export default async function NewAssistidoPage() {
  const { supabase } = await requireDepartment(ATENDIMENTO_FRATERNO);

  const [
    { data: sectorRows },
    { data: schedules },
    { data: distonias },
    { data: queixas },
  ] = await Promise.all([
    supabase
      .from("cepzk_setor")
      .select("id, nome, departamento:cepzk_departamento (nome)")
      .order("nome")
      .returns<SectorRow[]>(),
    supabase
      .from("cepzk_horario")
      .select("id, nome")
      .order("id")
      .returns<CatalogItem[]>(),
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

  const sectors: SectorItem[] = (sectorRows ?? []).map((row) => ({
    id: row.id,
    nome: row.nome,
    departamento: (Array.isArray(row.departamento)
      ? row.departamento[0]
      : row.departamento
    )?.nome ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href="/assistidos"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-teal-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Assistidos
      </Link>

      <NewAssistidoFlow
        sectors={sectors}
        schedules={schedules ?? []}
        distonias={distonias ?? []}
        queixas={queixas ?? []}
      />
    </main>
  );
}
