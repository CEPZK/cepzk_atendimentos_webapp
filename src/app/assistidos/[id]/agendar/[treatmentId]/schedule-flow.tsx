"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem } from "@/lib/assistido";
import type { NameColor } from "@/lib/aca-agenda";
import {
  SESSION_COUNT,
  buildNameColors,
  dayKey,
  formatLongDate,
  formatShortDate,
  formatTime,
  isOnDay,
  nameColor,
  sessionDates,
} from "@/lib/aca-agenda";
import { AcaMonthCalendar } from "@/app/aca-month-calendar";
import {
  SessionProceduresFields,
  type SessionProcedures,
} from "@/app/session-procedures-fields";
import {
  TreatmentSummaryCard,
  type TreatmentSummary,
} from "@/app/treatment-summary-card";
import { scheduleAcaTreatment } from "../../../actions";

/** A day the atendimento happens, with who is already booked on it. */
export interface CalendarDay {
  /** Instant of the session, in ISO. */
  iso: string;
  assistidos: string[];
}

interface ScheduleFlowProps {
  assistidoId: number;
  /** `?from=...` of the list the volunteer came from, kept on the way back. */
  backQuery: string;
  treatmentId: number;
  assistidoNome: string;
  horario: string;
  days: CalendarDay[];
  treatment: TreatmentSummary;
  procedimentos: CatalogItem[];
  /**
   * `YYYY-MM-DD` key of the current day in the house's time zone, given by
   * the page: the session that falls on it is highlighted.
   */
  today: string;
}

/**
 * Two steps: pick the first day from the calendar of the atendimento,
 * then fill in the procedures of the three sessions (one every other
 * week) and confirm.
 */
export function ScheduleFlow({
  assistidoId,
  backQuery,
  treatmentId,
  assistidoNome,
  horario,
  days,
  treatment,
  procedimentos,
  today,
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

      router.push(`/assistidos/${assistidoId}${backQuery}`);
      router.refresh();
    });
  }

  if (!selected) {
    return (
      <CalendarStep
        horario={horario}
        days={days}
        today={today}
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
          className="text-sm font-medium text-sky-700 transition-colors hover:text-sky-800"
        >
          Trocar o dia
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        A primeira sessão é no dia escolhido; as demais, a cada 15 dias.
      </p>

      <TreatmentSummaryCard treatment={treatment} />

      <ol className="mt-4 space-y-3">
        {dates.map((date, index) => {
          // A sessão do dia corrente ganha destaque: quem começa a
          // assistência no próprio dia do atendimento vê logo qual é.
          const isToday = isOnDay(date, today);

          return (
            <li
              key={date.toISOString()}
              aria-current={isToday ? "date" : undefined}
              className={`rounded-2xl border p-4 shadow-sm ${
                isToday
                  ? "border-sky-300 bg-sky-50/70 ring-1 ring-inset ring-sky-200"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 first-letter:uppercase">
                  {index + 1}ª sessão — {formatLongDate(date)}
                </p>
                {isToday && (
                  <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    Hoje
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {formatShortDate(date)} · {formatTime(date)}
              </p>

              <SessionProceduresFields
                procedimentos={procedimentos}
                value={sessions[index] ?? [null]}
                onChange={(next) => updateSession(index, next)}
              />
            </li>
          );
        })}
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
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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

/** First step: the month calendar and the day's choice dialog. */
function CalendarStep({
  horario,
  days,
  today,
  onChoose,
}: {
  horario: string;
  days: CalendarDay[];
  /** `YYYY-MM-DD` key of the current day in the house's time zone. */
  today: string;
  onChoose: (iso: string) => void;
}) {
  const byDay = useMemo(
    () => new Map(days.map((day) => [dayKey(day.iso), day])),
    [days],
  );
  const colors = useMemo(
    () => buildNameColors(days.flatMap((day) => day.assistidos)),
    [days],
  );
  const [open, setOpen] = useState<string | null>(null);

  const openDay = open ? byDay.get(open) : null;

  return (
    <>
      <AcaMonthCalendar
        title="Escolha o dia da primeira sessão"
        description={`Só os dias de atendimento (${horario}) podem ser escolhidos.`}
        days={days}
        onSelectDay={setOpen}
      />
      {openDay && (
        <DayDialog
          day={openDay}
          colors={colors}
          isToday={dayKey(openDay.iso) === today}
          onCancel={() => setOpen(null)}
          onChoose={() => onChoose(openDay.iso)}
        />
      )}
    </>
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
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
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

/** The day of the atendimento: who is booked on it, and the choice. */
function DayDialog({
  day,
  colors,
  isToday,
  onCancel,
  onChoose,
}: {
  day: CalendarDay;
  colors: Map<string, NameColor>;
  /** Whether the day being chosen is the current one. */
  isToday: boolean;
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
          className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900 first-letter:uppercase"
        >
          {formatLongDate(day.iso)}
          {isToday && (
            <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              Hoje
            </span>
          )}
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
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    (colors.get(nome) ?? nameColor(nome)).dot
                  }`}
                  aria-hidden="true"
                />
                {nome}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onChoose}
            className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 sm:flex-1"
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
