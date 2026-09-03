"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NameColor } from "@/lib/aca-agenda";
import {
  buildNameColors,
  dayKey,
  formatLongDate,
  formatShortDate,
  formatTime,
  nameColor,
} from "@/lib/aca-agenda";
import { AcaMonthCalendar } from "@/app/aca-month-calendar";
import { ChevronRightIcon } from "@/app/icons";

/** One assistido booked on a calendar day, with their ACA treatment. */
export interface CalendarAssistido {
  treatmentId: number;
  nome: string;
}

/** A day of the calendar, with the assistidos scheduled on it. */
export interface CalendarDay {
  /** Instant of the session, in ISO. */
  iso: string;
  assistidos: CalendarAssistido[];
}

/**
 * The sessions calendar. Same grid as the treatment start, but clicking a
 * day lists the assistidos booked on it and clicking one of them opens
 * their treatment (sessions and procedures) for editing.
 */
export function CalendarScreen({
  days,
  horarios,
}: {
  days: CalendarDay[];
  horarios: string;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const byDay = useMemo(
    () => new Map(days.map((day) => [dayKey(day.iso), day])),
    [days],
  );
  const colors = useMemo(
    () => buildNameColors(days.flatMap((day) => day.assistidos.map((a) => a.nome))),
    [days],
  );

  const openDay = openKey ? byDay.get(openKey) : null;

  return (
    <>
      <AcaMonthCalendar
        title="Sessões do Acolher com Amor"
        description={`Só os dias de atendimento (${horarios}) têm sessões.`}
        days={days.map((day) => ({
          iso: day.iso,
          assistidos: day.assistidos.map((item) => item.nome),
        }))}
        onSelectDay={setOpenKey}
      />

      {openDay && (
        <DayAgendaDialog
          day={openDay}
          colors={colors}
          onClose={() => setOpenKey(null)}
        />
      )}
    </>
  );
}

/** The assistidos booked on one day; each one opens their treatment. */
function DayAgendaDialog({
  day,
  colors,
  onClose,
}: {
  day: CalendarDay;
  colors: Map<string, NameColor>;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dia-agenda"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3
          id="dia-agenda"
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
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {day.assistidos.map((assistido) => (
              <li key={assistido.treatmentId}>
                <Link
                  href={`/acolher-com-amor/calendario/${assistido.treatmentId}`}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600"
                >
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                      (colors.get(assistido.nome) ?? nameColor(assistido.nome)).dot
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{assistido.nome}</span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
