import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDepartment } from "@/lib/current-volunteer";
import {
  ATENDIMENTO_FRATERNO,
  treatmentStateLabel,
  type Assistido,
  type TreatmentView,
} from "@/lib/assistido";
import { fullName, type VolunteerProfile } from "@/lib/volunteer";
import { ArrowLeftIcon, HeartIcon } from "@/app/icons";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await requireDepartment(ATENDIMENTO_FRATERNO);
  const { data } = await supabase
    .from("cepzk_assistido")
    .select("nome_completo")
    .eq("id", id)
    .maybeSingle<{ nome_completo: string }>();

  return { title: data?.nome_completo ?? "Assistido" };
}

/** PostgREST returns embedded rows as an object or as a single-item array. */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface AssistidoRow extends Assistido {
  entrevistador:
    | Pick<VolunteerProfile, "nome" | "sobrenome">
    | Pick<VolunteerProfile, "nome" | "sobrenome">[]
    | null;
}

interface TreatmentRow {
  id: number;
  estado: string;
  obs: string | null;
  setor: { nome: string; departamento: { nome: string } | null } | null;
  horario: { nome: string } | null;
  aca: { distonia: { nome: string } | null } | null;
  queixas: { queixa: { nome: string } | null }[] | null;
}

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });

export default async function AssistidoPage({ params }: PageProps) {
  const { id } = await params;
  const { supabase } = await requireDepartment(ATENDIMENTO_FRATERNO);

  const [{ data: assistido }, { data: treatmentRows }] = await Promise.all([
    supabase
      .from("cepzk_assistido")
      .select(
        "id, nome_completo, data_criacao, entrevistador:cepzk_voluntario (nome, sobrenome)",
      )
      .eq("id", id)
      .maybeSingle<AssistidoRow>(),
    supabase
      .from("cepzk_tratamento")
      .select(
        "id, estado, obs, setor:cepzk_setor (nome, departamento:cepzk_departamento (nome)), horario:cepzk_horario (nome), aca:aca_tratamento (distonia:aca_distonia (nome)), queixas:aca_tratamento_queixa (queixa:aca_queixa (nome))",
      )
      .eq("assistido_id", id)
      .returns<TreatmentRow[]>(),
  ]);

  if (!assistido) {
    notFound();
  }

  const interviewer = one(assistido.entrevistador);

  const treatments: TreatmentView[] = (treatmentRows ?? [])
    .map((row) => {
      const setor = one(row.setor);
      return {
        id: row.id,
        setor: setor?.nome ?? "Setor",
        departamento: one(setor?.departamento)?.nome ?? null,
        horario: one(row.horario)?.nome ?? "—",
        estado: row.estado,
        obs: row.obs,
        distonia: one(one(row.aca)?.distonia)?.nome ?? null,
        queixas: (row.queixas ?? [])
          .map((item) => one(item.queixa)?.nome)
          .filter((nome): nome is string => Boolean(nome))
          .sort((a, b) => a.localeCompare(b, "pt-BR")),
      };
    })
    .sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link
        href="/assistidos"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-teal-700"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Assistidos
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        {assistido.nome_completo}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Consulta somente leitura: estes dados não podem ser alterados por aqui.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Dados</h2>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-slate-500">Nome completo</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {assistido.nome_completo}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Entrevistador</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {interviewer ? fullName(interviewer) || "—" : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Cadastrado em</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {assistido.data_criacao
                ? DATE_FORMAT.format(new Date(assistido.data_criacao))
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Tratamentos{treatments.length > 0 && ` (${treatments.length})`}
        </h2>

        {treatments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nenhum tratamento registrado.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {treatments.map((treatment) => (
              <li
                key={treatment.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {treatment.setor}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {treatmentStateLabel(treatment.estado)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {[treatment.departamento, treatment.horario]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {treatment.distonia && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                    <HeartIcon className="h-4 w-4 shrink-0 text-teal-700" />
                    <span>
                      <span className="text-slate-500">
                        Distonia relatada:{" "}
                      </span>
                      {treatment.distonia}
                    </span>
                  </p>
                )}

                {treatment.queixas.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500">Principais queixas</p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {treatment.queixas.map((queixa) => (
                        <li
                          key={queixa}
                          className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700"
                        >
                          {queixa}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {treatment.obs && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">Observações</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                      {treatment.obs}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
