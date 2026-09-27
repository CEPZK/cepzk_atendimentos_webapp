import { describe, expect, it } from "vitest";
import type { TreatmentInput } from "./assistido";
import type { AtendimentoItem } from "./atendimento";
import { canAddTreatment, treatmentOptions, treatmentSelectionError } from "./treatment-selection";

const atendimentos: AtendimentoItem[] = [1, 2].map((id) => ({
  id, setorId: id, setor: `Setor ${id}`, departamento: null,
  horario: "Sábado", precedencia: 1,
}));
const draft = (atendimentoId: number | null): TreatmentInput => ({
  atendimentoId, distoniaId: null, queixaIds: [], obs: "",
});

describe("treatment selection", () => {
  it("requires at least one row for new assistidos but allows name-only edits", () => {
    expect(treatmentSelectionError([], atendimentos)).toBe("Inclua ao menos uma assistência.");
    expect(treatmentSelectionError([], atendimentos, false)).toBeNull();
    expect(canAddTreatment([], atendimentos)).toBe(true);
  });

  it("rejects blank rows even when new treatments are optional", () => {
    expect(treatmentSelectionError([draft(null)], atendimentos, false)).toBe(
      "Escolha o atendimento de cada assistência.",
    );
    expect(canAddTreatment([draft(null)], atendimentos)).toBe(false);
  });

  it.each([0, 999, NaN])("rejects an unavailable selection (%s)", (id) => {
    expect(treatmentSelectionError([draft(id)], atendimentos)).toBe(
      "Este atendimento não está disponível para assistência.",
    );
    expect(canAddTreatment([draft(id)], atendimentos)).toBe(false);
  });

  it("rejects duplicate IDs even if the payload bypasses the filtered options", () => {
    const treatments = [draft(1), draft(1)];
    expect(treatmentSelectionError(treatments, atendimentos)).toContain("Há duas assistências");
    expect(canAddTreatment(treatments, atendimentos)).toBe(false);
  });

  it("keeps the current option and restores it elsewhere after removal", () => {
    const treatments = [draft(1), draft(2)];
    expect(treatmentOptions(atendimentos, treatments, 0)).toEqual([atendimentos[0]]);
    expect(treatmentOptions(atendimentos, treatments)).toEqual([]);
    expect(treatmentOptions(atendimentos, [draft(2)])).toEqual([atendimentos[0]]);
    expect(treatmentSelectionError(treatments, atendimentos)).toBeNull();
    expect(canAddTreatment(treatments, atendimentos)).toBe(false);
  });

  it("does not offer new rows without a catalog", () => {
    expect(canAddTreatment([], [])).toBe(false);
    expect(treatmentOptions([], [])).toEqual([]);
  });
});
