import { HeartIcon } from "@/app/icons";

/** The treatment being scheduled/edited, as recorded at the registration. */
export interface TreatmentSummary {
  distonia: string | null;
  queixas: string[];
  obs: string | null;
}

/**
 * What the Atendimento Fraterno recorded about this treatment.
 *
 * The procedures of each session are chosen from the distonia and the
 * complaints, so they are read here, next to the selects, instead of
 * forcing a trip back to the assistido's screen.
 */
export function TreatmentSummaryCard({
  treatment,
}: {
  treatment: TreatmentSummary;
}) {
  const isEmpty =
    !treatment.distonia && treatment.queixas.length === 0 && !treatment.obs;

  if (isEmpty) return null;

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">
        Dados do tratamento
      </h3>

      {treatment.distonia && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <HeartIcon className="h-4 w-4 shrink-0 text-teal-700" />
          <span>
            <span className="text-slate-500">Distonia relatada: </span>
            {treatment.distonia}
          </span>
        </p>
      )}

      {treatment.queixas.length > 0 && (
        <div className="mt-3">
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
    </section>
  );
}
