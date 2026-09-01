"use client";

import {
  ACA_SECTOR,
  DEFAULT_DISTONIA,
  TEA_DISTONIA,
  type CatalogItem,
  type SectorItem,
  type TreatmentInput,
} from "@/lib/assistido";
import { TrashIcon } from "@/app/icons";

export const FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

export function emptyTreatment(): TreatmentInput {
  return {
    setorId: null,
    horarioId: null,
    distoniaId: null,
    queixaIds: [],
    obs: "",
  };
}

interface TreatmentFieldsProps {
  index: number;
  treatment: TreatmentInput;
  sectors: SectorItem[];
  schedules: CatalogItem[];
  distonias: CatalogItem[];
  queixas: CatalogItem[];
  canRemove: boolean;
  onChange: (treatment: TreatmentInput) => void;
  onRemove: () => void;
}

/**
 * One treatment of the assistido.
 *
 * Acolher com Amor carries extra information: the reported distonia and,
 * for TEA, the main complaints. Both only appear once the sector is
 * chosen, so the other treatments stay short.
 */
export function TreatmentFields({
  index,
  treatment,
  sectors,
  schedules,
  distonias,
  queixas,
  canRemove,
  onChange,
  onRemove,
}: TreatmentFieldsProps) {
  const sector = sectors.find((item) => item.id === treatment.setorId);
  const isAca = sector?.nome === ACA_SECTOR;
  const distonia = distonias.find((item) => item.id === treatment.distoniaId);
  const isTea = isAca && distonia?.nome === TEA_DISTONIA;

  function handleSectorChange(value: string) {
    const setorId = value ? Number(value) : null;
    const nextSector = sectors.find((item) => item.id === setorId);
    const isNextAca = nextSector?.nome === ACA_SECTOR;

    onChange({
      ...treatment,
      setorId,
      // "Outros" comes pre-selected, as the team asked.
      distoniaId: isNextAca
        ? (treatment.distoniaId ??
          distonias.find((item) => item.nome === DEFAULT_DISTONIA)?.id ??
          null)
        : null,
      queixaIds: isNextAca ? treatment.queixaIds : [],
    });
  }

  function handleDistoniaChange(value: string) {
    const distoniaId = value ? Number(value) : null;
    const nextDistonia = distonias.find((item) => item.id === distoniaId);
    onChange({
      ...treatment,
      distoniaId,
      // The complaints belong to TEA; leaving it clears them.
      queixaIds: nextDistonia?.nome === TEA_DISTONIA ? treatment.queixaIds : [],
    });
  }

  function toggleQueixa(queixaId: number, checked: boolean) {
    onChange({
      ...treatment,
      queixaIds: checked
        ? [...treatment.queixaIds, queixaId]
        : treatment.queixaIds.filter((id) => id !== queixaId),
    });
  }

  const fieldId = (name: string) => `tratamento-${index}-${name}`;

  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Tratamento {index + 1}
        </h3>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-600"
          >
            <TrashIcon className="h-4 w-4" />
            Remover
          </button>
        )}
      </div>

      <div className="mt-3 space-y-4">
        <div>
          <label
            htmlFor={fieldId("setor")}
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Setor
          </label>
          <select
            id={fieldId("setor")}
            value={treatment.setorId ?? ""}
            onChange={(event) => handleSectorChange(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">Selecione o setor</option>
            {sectors.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={fieldId("horario")}
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Horário
          </label>
          <select
            id={fieldId("horario")}
            value={treatment.horarioId ?? ""}
            onChange={(event) =>
              onChange({
                ...treatment,
                horarioId: event.target.value
                  ? Number(event.target.value)
                  : null,
              })
            }
            className={FIELD_CLASS}
          >
            <option value="">Selecione o horário</option>
            {schedules.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </div>

        {isAca && (
          <div>
            <label
              htmlFor={fieldId("distonia")}
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Distonia Relatada
            </label>
            <select
              id={fieldId("distonia")}
              value={treatment.distoniaId ?? ""}
              onChange={(event) => handleDistoniaChange(event.target.value)}
              className={FIELD_CLASS}
            >
              {distonias.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>
        )}

        {isTea && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700">
              Principais Queixas
            </legend>
            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              {queixas.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2.5 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={treatment.queixaIds.includes(item.id)}
                    onChange={(event) =>
                      toggleQueixa(item.id, event.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  {item.nome}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div>
          <label
            htmlFor={fieldId("obs")}
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Observações
          </label>
          <textarea
            id={fieldId("obs")}
            value={treatment.obs}
            onChange={(event) =>
              onChange({ ...treatment, obs: event.target.value })
            }
            rows={3}
            placeholder="Anotações da entrevista (opcional)"
            className={FIELD_CLASS}
          />
        </div>
      </div>
    </li>
  );
}
