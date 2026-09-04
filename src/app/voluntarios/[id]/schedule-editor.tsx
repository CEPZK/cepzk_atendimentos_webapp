"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleEntry } from "@/lib/volunteer";
import { atendimentoLabel, type AtendimentoItem } from "@/lib/atendimento";
import { CalendarHeartIcon, PlusIcon, TrashIcon } from "@/app/icons";
import { addScheduleEntry, removeScheduleEntry } from "../actions";

export function ScheduleEditor({
  volunteerId,
  entries,
  atendimentos,
}: {
  volunteerId: string;
  entries: ScheduleEntry[];
  /** Sector + schedule combinations the house offers. */
  atendimentos: AtendimentoItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [atendimentoId, setAtendimentoId] = useState<string>("");
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await action();
      setFeedback({
        ok: result.ok,
        message: result.message ?? (result.ok ? "Pronto." : "Erro."),
      });
      if (result.ok) router.refresh();
    });
  }

  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!atendimentoId) {
      setFeedback({ ok: false, message: "Selecione o atendimento." });
      return;
    }
    run(async () => {
      const result = await addScheduleEntry(volunteerId, Number(atendimentoId));
      if (result.ok) setAtendimentoId("");
      return result;
    });
  }

  const selectClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30";

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <CalendarHeartIcon className="h-5 w-5 text-sky-700" />
        Escalas
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Atendimentos em que este voluntário atua.
      </p>

      <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {entries.map((entry) => (
          <li
            key={entry.atendimento_id}
            className="flex items-center gap-3 p-3.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-900">
                {entry.setor}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {entry.horario}
                {entry.departamento ? ` · ${entry.departamento}` : ""}
              </span>
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(() =>
                  removeScheduleEntry(volunteerId, entry.atendimento_id),
                )
              }
              aria-label={`Desassociar de ${entry.setor} — ${entry.horario}`}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </li>
        ))}

        {entries.length === 0 && (
          <li className="p-6 text-center text-sm text-slate-500">
            Este voluntário ainda não está associado a nenhuma escala.
          </li>
        )}
      </ul>

      <form onSubmit={handleAdd} className="mt-4 space-y-3">
        <div>
          <label
            htmlFor="atendimento"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Atendimento
          </label>
          <select
            id="atendimento"
            value={atendimentoId}
            onChange={(event) => setAtendimentoId(event.target.value)}
            className={selectClass}
          >
            <option value="">Selecione…</option>
            {atendimentos.map((atendimento) => (
              <option key={atendimento.id} value={atendimento.id}>
                {atendimentoLabel(atendimento)}
              </option>
            ))}
          </select>
        </div>

        {feedback && (
          <p
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm ${
              feedback.ok
                ? "border-sky-200 bg-sky-50 text-sky-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sky-600 px-4 py-2.5 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlusIcon className="h-5 w-5" />
          {isPending ? "Salvando..." : "Associar a uma escala"}
        </button>
      </form>
    </section>
  );
}
