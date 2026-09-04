import type { Metadata } from "next";
import Link from "next/link";
import { requireSector } from "@/lib/current-volunteer";
import {
  ACA_SECTOR,
  buildAcaWaitlist,
  ESTADO_PENDENTE,
  type AcaWaitlistTreatmentRow,
  type Assistido,
} from "@/lib/assistido";
import {
  mapAtendimento,
  one,
  ATENDIMENTO_SELECT,
  type AtendimentoRow,
} from "@/lib/atendimento";
import { ArrowLeftIcon } from "@/app/icons";
import { WaitlistList } from "./waitlist-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lista de Espera — Acolher com Amor",
};

interface TreatmentRow {
  assistido_id: number;
  estado: string;
  data_atualizacao: string;
  atendimento: AtendimentoRow | AtendimentoRow[] | null;
  assistido: { nome_completo: string } | { nome_completo: string }[] | null;
}

export default async function AcaWaitlistPage() {
  // Só o time do Acolher com Amor (e o admin) acompanha esta fila.
  const { supabase } = await requireSector(ACA_SECTOR);

  // Todos os tratamentos pendentes de todo mundo: o próximo tratamento de
  // cada assistido é decidido pela menor precedência entre eles, então a
  // consulta não pode se limitar aos tratamentos do Acolher com Amor.
  const { data, error } = await supabase
    .from("cepzk_tratamento")
    .select(
      `assistido_id, estado, data_atualizacao, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT}), assistido:cepzk_assistido (nome_completo)`,
    )
    .eq("estado", ESTADO_PENDENTE)
    .returns<TreatmentRow[]>();

  const rows: AcaWaitlistTreatmentRow[] = (data ?? []).map((row) => {
    const atendimentoRow = one(row.atendimento);
    const atendimento = atendimentoRow ? mapAtendimento(atendimentoRow) : null;
    return {
      assistido_id: row.assistido_id,
      estado: row.estado,
      precedencia: atendimento?.precedencia ?? null,
      setor: atendimento?.setor ?? "",
      data_atualizacao: row.data_atualizacao,
    };
  });

  const assistidos: Assistido[] = (data ?? []).map((row) => ({
    id: row.assistido_id,
    nome_completo: one(row.assistido)?.nome_completo ?? "—",
  }));

  const waitlist = buildAcaWaitlist(assistidos, rows);

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
        Lista de Espera para o Acolher com Amor
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Assistidos cujo próximo tratamento é o Acolher com Amor, dos mais
        antigos aos mais recentes na espera.
      </p>

      {error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar a lista de espera ({error.code}:{" "}
          {error.message}).
        </p>
      ) : (
        <WaitlistList assistidos={waitlist} />
      )}
    </main>
  );
}
