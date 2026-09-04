import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDepartmentOnly } from "@/lib/current-volunteer";
import {
  ATENDIMENTO_FRATERNO,
  treatmentStateRank,
  type CatalogItem,
} from "@/lib/assistido";
import {
  mapAtendimento,
  sortAtendimentos,
  ATENDIMENTO_SELECT,
  one,
  type AtendimentoItem,
  type AtendimentoRow,
} from "@/lib/atendimento";
import { ArrowLeftIcon } from "@/app/icons";
import {
  CadastroAssistidoForm,
  type ExistingTreatmentView,
} from "../cadastro-assistido-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AssistidoRow {
  id: number;
  nome_completo: string;
  data_arquivamento: string | null;
}

interface TreatmentRow {
  id: number;
  estado: string;
  obs: string | null;
  data_arquivamento: string | null;
  atendimento_id: number | null;
  atendimento: AtendimentoRow | AtendimentoRow[] | null;
  aca:
    | { distonia: { nome: string } | { nome: string }[] | null }
    | { distonia: { nome: string } | { nome: string }[] | null }[]
    | null;
  queixas: { queixa: { nome: string } | { nome: string }[] | null }[] | null;
}

/**
 * Read once per request: the page and `generateMetadata` ask for the same
 * assistido, and each extra round trip is felt as a slower screen.
 */
const loadCadastro = cache(async (id: string) => {
  const { supabase } = await requireDepartmentOnly(ATENDIMENTO_FRATERNO);

  const [
    { data: assistido },
    { data: treatmentRows },
    { data: atendimentoRows },
    { data: distonias },
    { data: queixas },
  ] = await Promise.all([
    supabase
      .from("cepzk_assistido")
      .select("id, nome_completo, data_arquivamento")
      .eq("id", id)
      .maybeSingle<AssistidoRow>(),
    supabase
      .from("cepzk_tratamento")
      .select(
        `id, estado, obs, data_arquivamento, atendimento_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT}), aca:aca_tratamento (distonia:aca_distonia (nome)), queixas:aca_tratamento_queixa (queixa:aca_queixa (nome))`,
      )
      .eq("assistido_id", id)
      .returns<TreatmentRow[]>(),
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

  const existingTreatments: ExistingTreatmentView[] = (treatmentRows ?? [])
    .map((row) => {
      const atendimento = one(row.atendimento);
      const mapped = atendimento ? mapAtendimento(atendimento) : null;
      return {
        id: row.id,
        atendimentoId: row.atendimento_id,
        setor: mapped?.setor ?? "Setor",
        horario: mapped?.horario ?? "—",
        precedencia: mapped?.precedencia ?? null,
        estado: row.estado,
        archived: Boolean(row.data_arquivamento),
        obs: row.obs,
        distonia: one(one(row.aca)?.distonia)?.nome ?? null,
        queixas: (row.queixas ?? [])
          .map((item) => one(item.queixa)?.nome)
          .filter((nome): nome is string => Boolean(nome))
          .sort((a, b) => a.localeCompare(b, "pt-BR")),
      };
    })
    // A precedência do atendimento manda: o mais prioritário primeiro.
    .sort(
      (a, b) =>
        (a.precedencia ?? Number.MAX_SAFE_INTEGER) -
          (b.precedencia ?? Number.MAX_SAFE_INTEGER) ||
        treatmentStateRank(a.estado) - treatmentStateRank(b.estado) ||
        a.setor.localeCompare(b.setor, "pt-BR") ||
        a.horario.localeCompare(b.horario, "pt-BR"),
    );

  const atendimentos: AtendimentoItem[] = sortAtendimentos(
    (atendimentoRows ?? []).map(mapAtendimento),
  );

  return { assistido, existingTreatments, atendimentos, distonias, queixas };
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { assistido } = await loadCadastro(id);

  return {
    title: assistido ? `Cadastrar ${assistido.nome_completo}` : "Cadastrar assistido",
  };
}

export default async function CadastrarAssistidoPage({ params }: PageProps) {
  const { id } = await params;
  const { assistido, existingTreatments, atendimentos, distonias, queixas } =
    await loadCadastro(id);

  if (!assistido) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href="/atendimento-fraterno/cadastrar"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-teal-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Cadastrar assistido
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Cadastrar assistido
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Continuando o cadastro de um assistido já registrado.
      </p>

      <CadastroAssistidoForm
        assistido={{
          id: assistido.id,
          nomeCompleto: assistido.nome_completo,
          archived: Boolean(assistido.data_arquivamento),
        }}
        existingTreatments={existingTreatments}
        atendimentos={atendimentos}
        distonias={distonias ?? []}
        queixas={queixas ?? []}
      />
    </main>
  );
}
