import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  loadVolunteerSectors,
  requireVolunteer,
} from "@/lib/current-volunteer";
import { isAdmin } from "@/lib/volunteer";
import {
  buildDesobsessaoInfantilList,
  DESOBSESSAO_INFANTIL_II_SECTOR,
  isDesobsessaoInfantilII,
} from "@/lib/assistido";
import {
  ATENDIMENTO_SELECT,
  mapAtendimento,
  one,
  type AtendimentoRow,
} from "@/lib/atendimento";
import { ArrowLeftIcon } from "@/app/icons";
import { DesobsessaoInfantilList } from "../desobsessao-infantil/di-list";
import { DI_II_FROM } from "../desobsessao-infantil/from-keys";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assistentes em Desobsessão Infantil II",
};

interface TreatmentRow {
  id: number;
  assistido_id: number;
  estado: string;
  data_atualizacao: string | null;
  data_arquivamento: string | null;
  atendimento: AtendimentoRow | AtendimentoRow[] | null;
  assistido:
    | { nome_completo: string; data_arquivamento: string | null }
    | { nome_completo: string; data_arquivamento: string | null }[]
    | null;
}

export default async function DesobsessaoInfantilIIPage() {
  const { supabase, volunteer } = await requireVolunteer();

  // Only volunteers scheduled for Desobsessão Infantil II (and admins)
  // see this list.
  if (!isAdmin(volunteer)) {
    const sectors = await loadVolunteerSectors(supabase, volunteer.id);
    if (!sectors.some((s) => isDesobsessaoInfantilII(s.nome))) {
      redirect("/");
    }
  }

  // Pull every treatment ever tied to DI II (archived included, so the
  // search bar can find past assistidos).
  const { data, error } = await supabase
    .from("cepzk_tratamento")
    .select(
      `id, estado, data_atualizacao, data_arquivamento, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT}), assistido:cepzk_assistido (nome_completo, data_arquivamento)`,
    )
    .returns<TreatmentRow[]>();

  const sectorRows = (data ?? [])
    .map((row) => {
      const atendimento = one(row.atendimento);
      const mapped = atendimento ? mapAtendimento(atendimento) : null;
      const assistido = one(row.assistido);
      return {
        id: row.id,
        assistido_id: row.assistido_id,
        estado: row.estado,
        data_atualizacao: row.data_atualizacao,
        data_arquivamento: row.data_arquivamento,
        setor: mapped?.setor ?? "",
        nome_completo: assistido?.nome_completo ?? null,
        assistido_data_arquivamento: assistido?.data_arquivamento ?? null,
      };
    })
    .filter((row) => isDesobsessaoInfantilII(row.setor));

  const active = buildDesobsessaoInfantilList(
    sectorRows,
    DESOBSESSAO_INFANTIL_II_SECTOR,
  );

  // Search pool includes archived assistidos / archived treatments as long
  // as they have at least one DI II treatment.
  const allForSearch = (() => {
    const byId = new Map<
      number,
      { nome: string; estado: string | null; updatedAt: number }
    >();
    for (const row of sectorRows) {
      const updatedAt = row.data_atualizacao
        ? new Date(row.data_atualizacao).getTime()
        : 0;
      const existing = byId.get(row.assistido_id);
      if (!existing || updatedAt >= existing.updatedAt) {
        byId.set(row.assistido_id, {
          nome: row.nome_completo ?? "—",
          estado: row.estado,
          updatedAt,
        });
      }
    }
    return [...byId.entries()]
      .map(([id, v]) => ({
        id,
        nome_completo: v.nome,
        estado: v.estado,
        treatmentId: null,
      }))
      .sort((a, b) =>
        a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
      );
  })();

  const activeIds = new Set(active.map((a) => a.id));
  const merged = [
    ...active,
    ...allForSearch.filter((r) => !activeIds.has(r.id)),
  ];

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
        Assistentes em Desobsessão Infantil II
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Assistidos com tratamento ativo da Desobsessão Infantil II,
        ordenados alfabeticamente. Use a busca para encontrar assistidos
        arquivados.
      </p>

      {error ? (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Não foi possível carregar os assistidos ({error.code}:{" "}
          {error.message}).
        </p>
      ) : (
        <DesobsessaoInfantilList
          assistidos={merged}
          from={DI_II_FROM}
          emptyLabel="Nenhum assistido com tratamento da Desobsessão Infantil II no momento."
        />
      )}
    </main>
  );
}
