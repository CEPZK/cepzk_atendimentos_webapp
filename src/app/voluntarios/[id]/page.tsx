import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/current-volunteer";
import {
  fullName,
  type ScheduleEntry,
  type Volunteer,
} from "@/lib/volunteer";
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
  setor_id: number;
  horario_id: number;
  setor: { nome: string; departamento: { nome: string } | null } | null;
  horario: { nome: string } | null;
}

export default async function VolunteerPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase, volunteer: currentUser } = await requireAdmin();

  const [{ data: volunteer }, { data: scheduleRows }, { data: sectors }, { data: schedules }] =
    await Promise.all([
      supabase
        .from("cepzk_voluntario")
        .select("id, nome, sobrenome, email, telefone, papel, data_criacao")
        .eq("id", id)
        .maybeSingle<Volunteer>(),
      supabase
        .from("cepzk_escala")
        .select(
          "setor_id, horario_id, setor:cepzk_setor (nome, departamento:cepzk_departamento (nome)), horario:cepzk_horario (nome)",
        )
        .eq("voluntario_id", id)
        .returns<ScheduleRow[]>(),
      supabase
        .from("cepzk_setor")
        .select("id, nome")
        .order("nome")
        .returns<{ id: number; nome: string }[]>(),
      supabase
        .from("cepzk_horario")
        .select("id, nome")
        .order("id")
        .returns<{ id: number; nome: string }[]>(),
    ]);

  if (!volunteer) {
    notFound();
  }

  const entries: ScheduleEntry[] = (scheduleRows ?? [])
    .map((row) => ({
      setor_id: row.setor_id,
      horario_id: row.horario_id,
      setor: row.setor?.nome ?? `Setor ${row.setor_id}`,
      departamento: row.setor?.departamento?.nome ?? null,
      horario: row.horario?.nome ?? `Horário ${row.horario_id}`,
    }))
    .sort(
      (a, b) =>
        a.setor.localeCompare(b.setor) || a.horario.localeCompare(b.horario),
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
        sectors={sectors ?? []}
        schedules={schedules ?? []}
      />
    </main>
  );
}
