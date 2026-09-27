import type { TreatmentInput } from "./assistido";
import { atendimentoLabel, type AtendimentoItem } from "./atendimento";

/** Validate every draft row; a blank row must never be silently discarded. */
export function treatmentSelectionError(
  treatments: TreatmentInput[],
  atendimentos: AtendimentoItem[],
  required = true,
): string | null {
  if (required && treatments.length === 0) {
    return "Inclua ao menos uma assistência.";
  }

  const seen = new Set<number>();
  for (const treatment of treatments) {
    if (treatment.atendimentoId === null) {
      return "Escolha o atendimento de cada assistência.";
    }
    const atendimento = atendimentos.find(
      (item) => item.id === treatment.atendimentoId,
    );
    if (!atendimento) {
      return "Este atendimento não está disponível para assistência.";
    }
    if (seen.has(atendimento.id)) {
      return `Há duas assistências para ${atendimentoLabel(atendimento)}. O assistido entra uma vez em cada atendimento.`;
    }
    seen.add(atendimento.id);
  }
  return null;
}

/**
 * Exclude selections made in other rows, keeping this row's own selection.
 * Without an index, return the options available for a new row.
 */
export function treatmentOptions(
  atendimentos: AtendimentoItem[],
  treatments: TreatmentInput[],
  index?: number,
): AtendimentoItem[] {
  const used = new Set(
    treatments
      .filter((_, position) => position !== index)
      .map((treatment) => treatment.atendimentoId),
  );
  return atendimentos.filter((item) => !used.has(item.id));
}

/** Only one unfinished row at a time, and only while options remain. */
export function canAddTreatment(
  treatments: TreatmentInput[],
  atendimentos: AtendimentoItem[],
): boolean {
  return (
    treatmentSelectionError(treatments, atendimentos, false) === null &&
    treatments.length < atendimentos.length
  );
}
