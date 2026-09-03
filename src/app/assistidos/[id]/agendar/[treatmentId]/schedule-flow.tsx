"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem } from "@/lib/assistido";
import {
  SESSION_COUNT,
  WEEKDAY_INITIALS,
  dayKey,
  formatLongDate,
  formatShortDate,
  formatTime,
  monthGrid,
  monthOf,
  sessionDates,
  shiftMonth,
} from "@/lib/aca-agenda";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from "@/app/icons";
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
      <MonthCalendar
        horario={horario}
        days={days}
        onChoose={chooseDay}
      />
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

/**
 * The month calendar: the grid the team already reads in the Google
 * Calendar, with only the days of the atendimento open. Each of those
 * days carries the assistidos already booked on it; the rest of the
 * month stays visible but muted, so the date is read in context.
 */
function MonthCalendar({
  horario,
  days,
  onChoose,
}: {
  horario: string;
  days: CalendarDay[];
  onChoose: (iso: string) => void;
}) {
  const byDay = useMemo(
    () => new Map(days.map((day) => [dayKey(day.iso), day])),
    [days],
  );

  const first = days[0] ? monthOf(dayKey(days[0].iso)) : null;
  const last = days[days.length - 1]
    ? monthOf(dayKey(days[days.length - 1].iso))
    : null;

  const [cursor, setCursor] = useState(
    first ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
  );
  const [open, setOpen] = useState<string | null>(null);

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const index = cursor.year * 12 + cursor.month;
  const canGoBack = first ? index > first.year * 12 + first.month : false;
  const canGoForward = last ? index < last.year * 12 + last.month : false;

  const openDay = open ? byDay.get(open) : null;

  if (days.length === 0) {
    return (
      <p className="mt-6 text-sm text-slate-500">Nenhuma data disponível.</p>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-slate-900">
        Escolha o dia da primeira sessão
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Só os dias de atendimento ({horario}) podem ser escolhidos.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={() => setCursor(shiftMonth(cursor, -1))}
            disabled={!canGoBack}
            aria-label="Mês anterior"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <p className="text-sm font-semibold text-slate-900 first-letter:uppercase">
            {grid.label}
          </p>
          <button
            type="button"
            onClick={() => setCursor(shiftMonth(cursor, 1))}
            disabled={!canGoForward}
            aria-label="Próximo mês"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAY_INITIALS.map((initial, position) => (
            <div
              key={position}
              className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              {initial}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.weeks.flat().map((cell) => {
            const day = byDay.get(cell.key);
            const available = Boolean(day) && cell.inMonth;

            return (
              <div
                key={cell.key}
                className="min-h-[74px] border-b border-r border-slate-100 p-1 last:border-r-0 sm:min-h-[92px]"
              >
                {available ? (
                  <button
                    type="button"
                    onClick={() => setOpen(cell.key)}
                    className="flex h-full w-full flex-col items-start gap-1 rounded-lg bg-teal-50/70 p-1.5 text-left ring-1 ring-inset ring-teal-100 transition-colors hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <span className="text-sm font-semibold text-teal-800">
                      {cell.day}
                    </span>
                    <span className="text-[10px] font-medium text-teal-700">
                      {formatTime(day!.iso)}
                    </span>
                    {day!.assistidos.length > 0 && (
                      <span className="mt-auto w-full truncate rounded bg-teal-700 px-1 py-0.5 text-[10px] font-medium text-white">
                        {day!.assistidos.length} agendado
                        {day!.assistidos.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="p-1.5">
                    <span
                      className={`text-sm ${
                        cell.inMonth ? "text-slate-400" : "text-slate-300"
                      }`}
                    >
                      {cell.day}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {openDay && (
        <DayDialog
          day={openDay}
          onCancel={() => setOpen(null)}
          onChoose={() => onChoose(openDay.iso)}
        />
      )}
    </section>
  );
}

/** The day of the atendimento: who is booked on it, and the choice. */
function DayDialog({
  day,
  onCancel,
  onChoose,
}: {
  day: CalendarDay;
  onCancel: () => void;
  onChoose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dia-atendimento"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3
          id="dia-atendimento"
          className="text-base font-semibold text-slate-900 first-letter:uppercase"
        >
          {formatLongDate(day.iso)}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {formatShortDate(day.iso)} · {formatTime(day.iso)}
        </p>

        <p className="mt-4 text-xs font-medium text-slate-500">
          {day.assistidos.length === 0
            ? "Nenhum assistido agendado"
            : `Assistidos agendados (${day.assistidos.length})`}
        </p>
        {day.assistidos.length > 0 && (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {day.assistidos.map((nome) => (
              <li
                key={nome}
                className="rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
              >
                {nome}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onChoose}
            className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 sm:flex-1"
          >
            Começar neste dia
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:flex-1"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
