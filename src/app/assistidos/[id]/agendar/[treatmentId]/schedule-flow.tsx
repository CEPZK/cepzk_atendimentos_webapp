"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem } from "@/lib/assistido";
import {
  SESSION_COUNT,
  formatLongDate,
  formatShortDate,
  formatTime,
  sessionDates,
} from "@/lib/aca-agenda";
import { CalendarIcon, PlusIcon, TrashIcon } from "@/app/icons";
import { scheduleAcaTreatment } from "../../../actions";

/** A day the atendimento happens, with who is already booked on it. */
export interface CalendarDay {
  /** Instant of the session, in ISO. */
  iso: string;
  assistidos: string[];
}

interface ScheduleFlowProps {
  assistidoId: number;
  treatmentId: number;
  assistidoNome: string;
  horario: string;
  days: CalendarDay[];
  procedimentos: CatalogItem[];
}

/** Procedures chosen for each session; `null` = an empty row. */
type SessionProcedures = (number | null)[];

/**
 * Two steps: pick the first day from the calendar of the atendimento,
 * then fill in the procedures of the three sessions (one every other
 * week) and confirm.
 */
export function ScheduleFlow({
  assistidoId,
  treatmentId,
  assistidoNome,
  horario,
  days,
  procedimentos,
}: ScheduleFlowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionProcedures[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dates = useMemo(
    () => (selected ? sessionDates(new Date(selected)) : []),
    [selected],
  );

  function chooseDay(iso: string) {
    setError(null);
    setSelected(iso);
    setSessions(
      Array.from({ length: SESSION_COUNT }, () => [null] as SessionProcedures),
    );
  }

  function updateSession(index: number, next: SessionProcedures) {
    setSessions((current) =>
      current.map((session, i) => (i === index ? next : session)),
    );
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await scheduleAcaTreatment({
        treatmentId,
        sessions: dates.map((date, index) => ({
          data: date.toISOString(),
          procedimentoIds: (sessions[index] ?? []).filter(
            (id): id is number => id !== null,
          ),
        })),
      });

      if (!result.ok) {
        setConfirming(false);
        setError(result.message ?? "Não foi possível agendar.");
        return;
      }

      router.push(`/assistidos/${assistidoId}`);
      router.refresh();
    });
  }

  if (!selected) {
    return (
      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-900">
          Escolha o dia da primeira sessão
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Apenas os dias de atendimento ({horario}) são oferecidos.
        </p>

        {days.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Nenhuma data disponível.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {days.map((day) => (
              <li key={day.iso}>
                <button
                  type="button"
                  onClick={() => chooseDay(day.iso)}
                  className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-teal-600 hover:bg-teal-50/40 focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 shrink-0 text-teal-700" />
                    <span className="text-sm font-semibold text-slate-900 first-letter:uppercase">
                      {formatLongDate(day.iso)}
                    </span>
                  </span>
                  <span className="mt-0.5 text-xs text-slate-500">
                    {formatShortDate(day.iso)} · {formatTime(day.iso)}
                  </span>

                  <span className="mt-3 block text-xs text-slate-500">
                    {day.assistidos.length === 0
                      ? "Nenhum assistido agendado"
                      : `Agendados (${day.assistidos.length})`}
                  </span>
                  {day.assistidos.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {day.assistidos.map((nome) => (
                        <span
                          key={nome}
                          className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700"
                        >
                          {nome}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          Sessões de {assistidoNome}
        </h2>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="text-sm font-medium text-teal-700 transition-colors hover:text-teal-800"
        >
          Trocar o dia
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        A primeira sessão é no dia escolhido; as demais, a cada 15 dias.
      </p>

      <ol className="mt-4 space-y-3">
        {dates.map((date, index) => (
          <li
            key={date.toISOString()}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-900 first-letter:uppercase">
              {index + 1}ª sessão — {formatLongDate(date)}
            </p>
            <p className="text-xs text-slate-500">
              {formatShortDate(date)} · {formatTime(date)}
            </p>

            <SessionProceduresFields
              procedimentos={procedimentos}
              value={sessions[index] ?? [null]}
              onChange={(next) => updateSession(index, next)}
            />
          </li>
        ))}
      </ol>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isPending ? "Agendando..." : "Agendar"}
      </button>

      {confirming && (
        <ConfirmDialog
          assistidoNome={assistidoNome}
          dates={dates}
          isPending={isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={confirm}
        />
      )}
    </section>
  );
}

/**
 * The procedures of one session: as many as the team wants, never the
 * same one twice — the options already chosen leave the other selects.
 */
function SessionProceduresFields({
  procedimentos,
  value,
  onChange,
}: {
  procedimentos: CatalogItem[];
  value: SessionProcedures;
  onChange: (next: SessionProcedures) => void;
}) {
  const chosen = value.filter((id): id is number => id !== null);
  const canAdd = chosen.length === value.length && chosen.length < procedimentos.length;

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
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          >
            <option value="">Selecione o procedimento</option>
            {procedimentos
              .filter(
                (item) => item.id === procedimentoId || !chosen.includes(item.id),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
          </select>

          {value.length > 1 && (
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
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 transition-colors hover:text-teal-800"
        >
          <PlusIcon className="h-4 w-4" />
          Adicionar procedimento
        </button>
      )}
    </div>
  );
}

/** Scheduling changes the state of the treatment: it is confirmed first. */
function ConfirmDialog({
  assistidoNome,
  dates,
  isPending,
  onCancel,
  onConfirm,
}: {
  assistidoNome: string;
  dates: Date[];
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-agendamento"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3
          id="confirm-agendamento"
          className="text-base font-semibold text-slate-900"
        >
          Confirmar agendamento
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {assistidoNome} passa para <strong>em tratamento</strong> com estas
          sessões:
        </p>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {dates.map((date) => (
            <li key={date.toISOString()} className="first-letter:uppercase">
              {formatLongDate(date)} · {formatTime(date)}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
          >
            {isPending ? "Agendando..." : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 sm:flex-1"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
