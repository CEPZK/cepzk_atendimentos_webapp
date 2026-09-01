import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/current-volunteer";
import {
  fullName,
  type ScheduleEntry,
  type Volunteer,
} from "@/lib/volunteer";
import {
  mapAtendimento,
  sortAtendimentos,
  ATENDIMENTO_SELECT,
  type AtendimentoItem,
  type AtendimentoRow,
} from "@/lib/atendimento";
import { ArrowLeftIcon } from "@/app/icons";
import { VolunteerForm } from "./volunteer-form";
import { ScheduleEditor } from "./schedule-editor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("cepzk_voluntario")
    .select("nome, sobrenome")
    .eq("id", id)
    .maybeSingle<Pick<Volunteer, "nome" | "sobrenome">>();

  return { title: data ? fullName(data) || "Voluntário" : "Voluntário" };
}

interface ScheduleRow {
  atendimento_id: number;
  atendimento: AtendimentoRow | null;
}

export default async function VolunteerPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, volunteer: currentUser } = await requireAdmin();

  const [{ data: volunteer }, { data: scheduleRows }, { data: atendimentoRows }] =
    await Promise.all([
      supabase
        .from("cepzk_voluntario")
        .select("id, nome, sobrenome, email, telefone, papel, data_criacao")
        .eq("id", id)
        .maybeSingle<Volunteer>(),
      supabase
        .from("cepzk_escala")
        .select(`atendimento_id, atendimento:cepzk_atendimento (${ATENDIMENTO_SELECT})`)
        .eq("voluntario_id", id)
        .returns<ScheduleRow[]>(),
      supabase
        .from("cepzk_atendimento")
        .select(ATENDIMENTO_SELECT)
        .returns<AtendimentoRow[]>(),
    ]);

  if (!volunteer) {
    notFound();
  }

  const atendimentos: AtendimentoItem[] = sortAtendimentos(
    (atendimentoRows ?? []).map(mapAtendimento),
  );

  const entries: ScheduleEntry[] = (scheduleRows ?? [])
    .map((row) => {
      const atendimento = row.atendimento
        ? mapAtendimento(row.atendimento)
        : null;
      return {
        atendimento_id: row.atendimento_id,
        setor: atendimento?.setor ?? `Atendimento ${row.atendimento_id}`,
        departamento: atendimento?.departamento ?? null,
        horario: atendimento?.horario ?? "—",
      };
    })
    .sort(
      (a, b) =>
        a.setor.localeCompare(b.setor, "pt-BR") ||
        a.horario.localeCompare(b.horario, "pt-BR"),
    );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href="/voluntarios"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-teal-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Voluntários
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        {fullName(volunteer) || volunteer.email}
      </h1>
      <p className="mt-1 text-sm text-slate-500">{volunteer.email}</p>

      <VolunteerForm
        volunteer={volunteer}
        isCurrentUser={currentUser.id === volunteer.id}
      />

      <ScheduleEditor
        volunteerId={volunteer.id}
        entries={entries}
        atendimentos={atendimentos}
      />
    </main>
  );
}
