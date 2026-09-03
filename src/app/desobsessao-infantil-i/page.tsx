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
  isDesobsessaoInfantilI,
} from "@/lib/assistido";
import {
  ATENDIMENTO_SELECT,
  mapAtendimento,
  one,
  type AtendimentoRow,
} from "@/lib/atendimento";
import { ArrowLeftIcon } from "@/app/icons";
import { DesobsessaoInfantilList } from "../desobsessao-infantil/di-list";
import { DI_I_FROM } from "../desobsessao-infantil/from-keys";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Assistentes em Desobsessão Infantil I",
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

export default async function DesobsessaoInfantilIPage() {
  const { supabase, volunteer } = await requireVolunteer();

  // Only volunteers scheduled for Desobsessão Infantil I (and admins)
  // see this list.
  if (!isAdmin(volunteer)) {
    const sectors = await loadVolunteerSectors(supabase, volunteer.id);
    if (!sectors.some((s) => isDesobsessaoInfantilI(s.nome))) {
      redirect("/");
    }
  }

  // Pull every treatment ever tied to DI I (archived included, so the
  // search bar can find past assistidos). The filter for "active" is
  // done in buildDesobsessaoInfantilList, and the client-side search
  // over the merged dataset surfaces archived ones as well.
  const { data, error } = await supabase
    .from("cepzk_tratamento")
    .select(
      `id, estado, data_atualizacao, data_arquivamento, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT}), assistido:cepzk_assistido (nome_completo, data_arquivamento)`,
    )
    .returns<TreatmentRow[]>();

  // Map all treatments, keeping only those in the DI I sector. The
  // legacy name "Desobsessão Infantil" (without "I") is also treated
  // as DI I for backward compatibility.
  const allRows = (data ?? []).map((row) => {
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
  });
  const sectorRows = allRows.filter((row) => isDesobsessaoInfantilI(row.setor));

  // The "active" list shown on first paint (no archived rows).
  const active = buildDesobsessaoInfantilList(sectorRows, isDesobsessaoInfantilI);

  // For the search bar we also include archived assistidos and archived
  // treatments, as long as there is at least one DI I treatment
  // (archived or not). Same "most recent estado" logic — archived
  // entries are surfaced here for searching.
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

  // Merge active rows with search rows: the active list is the primary
  // dataset shown, and archived rows are appended for search.
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
        Assistentes em Desobsessão Infantil I
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Assistidos com tratamento ativo da Desobsessão Infantil I,
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
          from={DI_I_FROM}
          emptyLabel="Nenhum assistido com tratamento da Desobsessão Infantil I no momento."
        />
      )}
    </main>
  );
}
