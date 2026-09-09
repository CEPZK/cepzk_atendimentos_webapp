import { PuzzlePieceIcon } from "@/app/icons";

/** What the registration recorded about the assistido's treatment. */
export interface TreatmentSummary {
  distonia: string | null;
  queixas: string[];
  obs: string | null;
}

/** Whether there is anything at all to show about the assistido. */
export function isTreatmentSummaryEmpty(treatment: TreatmentSummary): boolean {
  return !treatment.distonia && treatment.queixas.length === 0 && !treatment.obs;
}

/**
 * Distonia, queixas e observações do cadastro — os dados do assistido
 * como são desenhados em toda parte.
 *
 * Exportado à parte do card para que uma tela que já tem o seu próprio
 * card (o relatório da sessão) mostre os mesmos dados sem repeti-los.
 */
export function TreatmentSummaryDetails({
  treatment,
}: {
  treatment: TreatmentSummary;
}) {
  return (
    <>
      {treatment.distonia && (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <PuzzlePieceIcon className="h-4 w-4 shrink-0 text-sky-700" />
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
                className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
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
    </>
  );
}

/**
 * What the Atendimento Fraterno recorded about the assistido.
 *
 * The procedures of each session are chosen from the distonia and the
 * complaints, so they are read here, next to the selects, instead of
 * forcing a trip back to the assistido's screen. The card is titled after
 * who the data describes — the assistido — which is how the Acolher com
 * Amor team reads it.
 */
export function TreatmentSummaryCard({
  treatment,
}: {
  treatment: TreatmentSummary;
}) {
  if (isTreatmentSummaryEmpty(treatment)) return null;

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">
        Dados do assistido
      </h3>

      <TreatmentSummaryDetails treatment={treatment} />
    </section>
  );
}
