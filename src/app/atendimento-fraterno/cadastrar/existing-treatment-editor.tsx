"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  treatmentStateChip,
  treatmentStateColorClass,
  type CatalogItem,
  type TreatmentInput,
} from "@/lib/assistido";
import type { AtendimentoItem } from "@/lib/atendimento";
import { ConfirmDialog } from "@/app/confirm-dialog";
import { PuzzlePieceIcon } from "@/app/icons";
import { TreatmentFields } from "@/app/treatment-fields";
import { removeTreatment, updateTreatment } from "./actions";
import type { ExistingTreatmentView } from "./cadastro-assistido-form";

const ACTION_BUTTON =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60";

const REMOVE_BUTTON =
  "rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:cursor-not-allowed disabled:opacity-60";

const SAVE_BUTTON =
  "rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 disabled:cursor-not-allowed disabled:opacity-60";

interface ExistingTreatmentEditorProps {
  /** An open (pendente/em tratamento) treatment of the assistido. */
  treatment: ExistingTreatmentView;
  /**
   * The atendimentos the edit form may pick: the unblocked ones plus the
   * treatment's current atendimento.
   */
  atendimentos: AtendimentoItem[];
  distonias: CatalogItem[];
  queixas: CatalogItem[];
}

/**
 * An open treatment on the cadastro screen: read-only summary with two
 * escape hatches — edit (atendimento, obs and the Acolher com Amor
 * extras) or remove, both server-validated. Concluded treatments never
 * come through here.
 */
export function ExistingTreatmentEditor({
  treatment,
  atendimentos,
  distonias,
  queixas,
}: ExistingTreatmentEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TreatmentInput>({
    atendimentoId: treatment.atendimentoId,
    distoniaId: treatment.distoniaId,
    queixaIds: treatment.queixaIds,
    obs: treatment.obs ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateTreatment({
        treatmentId: treatment.id,
        atendimentoId: draft.atendimentoId,
        obs: draft.obs,
        distoniaId: draft.distoniaId,
        queixaIds: draft.queixaIds,
      });
      if (!result.ok) {
        setError(result.message ?? "Não foi possível salvar.");
        return;
      }
      // Back to the read-only summary; refresh() brings the saved values.
      setEditing(false);
      router.refresh();
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeTreatment(treatment.id);
      setConfirmingRemove(false);
      if (!result.ok) {
        setError(result.message ?? "Não foi possível remover.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-slate-200 p-4">
      {editing ? (
        <>
          <TreatmentFields
            index={0}
            title={`Editar assistência — ${treatment.setor}`}
            treatment={draft}
            atendimentos={atendimentos}
            distonias={distonias}
            queixas={queixas}
            canRemove={false}
            onChange={setDraft}
            onRemove={() => undefined}
            wrap={false}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className={SAVE_BUTTON}
            >
              {isPending ? "Salvando..." : "Salvar alterações"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              disabled={isPending}
              className={ACTION_BUTTON}
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {treatment.setor}
            </span>
            <span className="text-xs text-slate-500">{treatment.horario}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${treatmentStateColorClass(
                treatment.estado,
              )}`}
            >
              {treatmentStateChip(treatment.estado)}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => {
                // Re-seed from the freshest props (a previous save may
                // have refreshed them while the summary was shown).
                setDraft({
                  atendimentoId: treatment.atendimentoId,
                  distoniaId: treatment.distoniaId,
                  queixaIds: treatment.queixaIds,
                  obs: treatment.obs ?? "",
                });
                setError(null);
                setEditing(true);
              }}
              disabled={isPending}
              className={ACTION_BUTTON}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(true)}
              disabled={isPending}
              className={REMOVE_BUTTON}
            >
              Remover
            </button>
          </div>

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
            <div className="mt-2">
              <p className="text-xs text-slate-500">Principais queixas</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                {treatment.queixas.map((queixa) => (
                  <li key={queixa}>{queixa}</li>
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
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {confirmingRemove && (
        <ConfirmDialog
          title="Remover assistência?"
          description={`A assistência de ${treatment.setor} (${treatment.horario}) será excluída. Essa ação não pode ser desfeita.`}
          confirmLabel="Remover"
          pendingLabel="Removendo..."
          isPending={isPending}
          onConfirm={handleRemove}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </li>
  );
}
