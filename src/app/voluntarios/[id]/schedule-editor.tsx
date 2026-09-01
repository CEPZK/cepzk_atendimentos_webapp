"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleEntry } from "@/lib/volunteer";
import { CalendarIcon, PlusIcon, TrashIcon } from "@/app/icons";
import { addScheduleEntry, removeScheduleEntry } from "../actions";

interface Option {
  id: number;
  nome: string;
}

export function ScheduleEditor({
  volunteerId,
  entries,
  sectors,
  schedules,
}: {
  volunteerId: string;
  entries: ScheduleEntry[];
  sectors: Option[];
  schedules: Option[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [setorId, setSetorId] = useState<string>("");
  const [horarioId, setHorarioId] = useState<string>("");
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
    if (!setorId || !horarioId) {
      setFeedback({ ok: false, message: "Selecione o setor e o horário." });
      return;
    }
    run(async () => {
      const result = await addScheduleEntry(
        volunteerId,
        Number(setorId),
        Number(horarioId),
      );
      if (result.ok) {
        setSetorId("");
        setHorarioId("");
      }
      return result;
    });
  }

  const selectClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30";

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <CalendarIcon className="h-5 w-5 text-teal-700" />
        Escalas
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Setores e horários em que este voluntário atua.
      </p>

      <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {entries.map((entry) => (
          <li
            key={`${entry.setor_id}-${entry.horario_id}`}
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
                  removeScheduleEntry(
                    volunteerId,
                    entry.setor_id,
                    entry.horario_id,
                  ),
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="setor" className="mb-1.5 block text-sm font-medium text-slate-700">
              Setor
            </label>
            <select
              id="setor"
              value={setorId}
              onChange={(event) => setSetorId(event.target.value)}
              className={selectClass}
            >
              <option value="">Selecione…</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="horario" className="mb-1.5 block text-sm font-medium text-slate-700">
              Horário
            </label>
            <select
              id="horario"
              value={horarioId}
              onChange={(event) => setHorarioId(event.target.value)}
              className={selectClass}
            >
              <option value="">Selecione…</option>
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {feedback && (
          <p
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm ${
              feedback.ok
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlusIcon className="h-5 w-5" />
          {isPending ? "Salvando..." : "Associar a uma escala"}
        </button>
      </form>
    </section>
  );
}
