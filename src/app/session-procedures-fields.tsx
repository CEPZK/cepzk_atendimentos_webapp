"use client";

import type { CatalogItem } from "@/lib/assistido";
import { PlusIcon, TrashIcon } from "@/app/icons";

/** Procedures chosen for each session; `null` = an empty row. */
export type SessionProcedures = (number | null)[];

/**
 * The procedures of one session: as many as the team wants, never the
 * same one twice — the options already chosen leave the other selects.
 *
 * Every chosen procedure can be removed (the trash is always available,
 * not only when there are two or more), and a new row is offered while
 * all rows are filled and the catalogue still has options.
 */
export function SessionProceduresFields({
  procedimentos,
  value,
  onChange,
}: {
  procedimentos: CatalogItem[];
  value: SessionProcedures;
  onChange: (next: SessionProcedures) => void;
}) {
  const chosen = value.filter((id): id is number => id !== null);
  const canAdd =
    chosen.length === value.length && chosen.length < procedimentos.length;

  return (
    <div className="mt-3 space-y-2">
      {value.map((procedimentoId, index) => (
        <div key={index} className="flex items-center gap-2">
          <select
            value={procedimentoId ?? ""}
            onChange={(event) =>
              onChange(
                value.map((item, i) =>
                  i === index
                    ? event.target.value
                      ? Number(event.target.value)
                      : null
                    : item,
                ),
              )
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30"
          >
            <option value="">Selecione o procedimento</option>
            {procedimentos
              .filter(
                (item) =>
                  item.id === procedimentoId || !chosen.includes(item.id),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
          </select>

          {procedimentoId !== null && (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              aria-label="Remover procedimento"
              className="shrink-0 rounded-lg border border-slate-300 p-2 text-slate-500 transition-colors hover:border-red-300 hover:text-red-600"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}

      {canAdd && (
        <button
          type="button"
          onClick={() => onChange([...value, null])}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 transition-colors hover:text-sky-800"
        >
          <PlusIcon className="h-4 w-4" />
          Adicionar procedimento
        </button>
      )}
    </div>
  );
}
