"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WEEKDAY_INITIALS,
  buildNameColors,
  dayKey,
  formatTime,
  monthGrid,
  monthOf,
  nameColor,
  shiftMonth,
  todayKey,
} from "@/lib/aca-agenda";
import { ChevronLeftIcon, ChevronRightIcon } from "@/app/icons";

/** A day the atendimento happens, with who is booked on it. */
export interface AgendaDay {
  /** Instant of the session, in ISO. */
  iso: string;
  assistidos: string[];
}

interface AcaMonthCalendarProps {
  title: string;
  description: string;
  days: AgendaDay[];
  /** Called with the `YYYY-MM-DD` key of the day the volunteer clicked. */
  onSelectDay: (key: string) => void;
}

/**
 * The month calendar the ACA team already reads in the Google Calendar:
 * only the days of the atendimento are open (each carrying the assistidos
 * booked on it, with a stable colour per name), while the rest of the
 * month stays visible but muted so the date is read in context.
 *
 * Shared by the two screens that draw this grid: the treatment start
 * (choose the first session) and the sessions calendar.
 */
export function AcaMonthCalendar({
  title,
  description,
  days,
  onSelectDay,
}: AcaMonthCalendarProps) {
  const byDay = useMemo(
    () => new Map(days.map((day) => [dayKey(day.iso), day])),
    [days],
  );

  // Uma cor por assistido, válida em toda a agenda: o mesmo nome tem a
  // mesma cor em qualquer dia e em qualquer mês da tela.
  const colors = useMemo(
    () => buildNameColors(days.flatMap((day) => day.assistidos)),
    [days],
  );

  const first = days[0] ? monthOf(dayKey(days[0].iso)) : null;
  const last = days[days.length - 1]
    ? monthOf(dayKey(days[days.length - 1].iso))
    : null;

  // O dia corrente na hora da casa, o mesmo critério que as telas usam
  // para dizer que uma sessão é "hoje".
  const [today, setToday] = useState(() => todayKey());

  // A tela pode ficar aberta na virada do dia (e o HTML vem do servidor):
  // relê o dia da casa no cliente e agenda a próxima virada.
  useEffect(() => {
    const tick = () => setToday(todayKey());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Abre no mês corrente quando ele tem dias de atendimento, para que o
  // destaque de hoje já esteja à vista.
  const [cursor, setCursor] = useState(() => {
    const fallback = first ?? {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
    };
    if (!first || !last) return fallback;
    const current = monthOf(todayKey());
    const index = current.year * 12 + current.month;
    if (
      index >= first.year * 12 + first.month &&
      index <= last.year * 12 + last.month
    ) {
      return current;
    }
    return fallback;
  });

  const grid = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  // Os dias da semana em que a casa atende. As outras colunas existem só
  // para situar a data, então ficam estreitas e devolvem a largura para
  // a coluna que interessa — com um único sábado, ele fica ~4x maior.
  const activeWeekdays = useMemo(() => {
    const weekdays = new Set<number>();
    for (const day of days) {
      const [year, month, date] = dayKey(day.iso).split("-").map(Number);
      weekdays.add(new Date(Date.UTC(year, month - 1, date)).getUTCDay());
    }
    return weekdays;
  }, [days]);

  const columns = useMemo(
    () =>
      Array.from({ length: 7 }, (_, weekday) =>
        activeWeekdays.has(weekday) ? "minmax(0,4fr)" : "minmax(0,1fr)",
      ).join(" "),
    [activeWeekdays],
  );

  const index = cursor.year * 12 + cursor.month;
  const canGoBack = first ? index > first.year * 12 + first.month : false;
  const canGoForward = last ? index < last.year * 12 + last.month : false;

  if (days.length === 0) {
    return (
      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <p className="mt-4 text-sm text-slate-500">
          Nenhuma data disponível.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

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

        <div
          className="grid border-b border-slate-200 bg-slate-50"
          style={{ gridTemplateColumns: columns }}
        >
          {WEEKDAY_INITIALS.map((initial, position) => (
            <div
              key={position}
              className={`px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${
                activeWeekdays.has(position) ? "text-slate-700" : "text-slate-400"
              }`}
            >
              {initial}
            </div>
          ))}
        </div>

        <div className="grid" style={{ gridTemplateColumns: columns }}>
          {grid.weeks.flat().map((cell) => {
            const day = byDay.get(cell.key);
            // Um dia de atendimento é escolhível mesmo quando pertence ao
            // mês vizinho: a grade de setembro já mostra os primeiros
            // sábados de outubro, e obrigar a virar o mês para clicar
            // neles é atrito puro.
            const available = Boolean(day);
            // O dia corrente fica marcado em toda a grade, tenha ou não
            // atendimento: é a referência que situa o voluntário no mês.
            const isToday = cell.key === today;

            return (
              <div
                key={cell.key}
                aria-current={isToday ? "date" : undefined}
                className={`relative min-h-[74px] border-b border-r border-slate-100 p-1 last:border-r-0 sm:min-h-[92px] ${
                  // Hoje é marcado só no contorno da célula, na cor do
                  // tema: nada de fundo colorido competindo com os chips.
                  isToday
                    ? "z-10 rounded-md ring-2 ring-inset ring-teal-600"
                    : ""
                }`}
              >
                {available ? (
                  <button
                    type="button"
                    onClick={() => onSelectDay(cell.key)}
                    className={`flex h-full w-full flex-col items-start gap-1 rounded-lg p-1.5 text-left ring-1 ring-inset transition-colors focus:outline-none focus:ring-2 focus:ring-teal-600 ${
                      cell.inMonth
                        ? "bg-teal-50/70 ring-teal-100 hover:bg-teal-100"
                        : // Fora do mês: mesma célula, apenas mais discreta.
                          "bg-teal-50/30 ring-teal-50 hover:bg-teal-100/70"
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold ${
                        cell.inMonth ? "text-teal-800" : "text-teal-700/60"
                      }`}
                    >
                      {cell.day}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        cell.inMonth ? "text-teal-700" : "text-teal-700/60"
                      }`}
                    >
                      {formatTime(day!.iso)}
                    </span>
                    {day!.assistidos.length > 0 && (
                      <span className="mt-1 flex w-full flex-col gap-0.5">
                        {day!.assistidos.slice(0, 4).map((nome) => (
                          <span
                            key={nome}
                            title={nome}
                            className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                              (colors.get(nome) ?? nameColor(nome)).chip
                            } ${cell.inMonth ? "" : "opacity-60"}`}
                          >
                            {nome}
                          </span>
                        ))}
                        {day!.assistidos.length > 4 && (
                          <span className="px-1 text-[10px] font-medium text-slate-500">
                            +{day!.assistidos.length - 4}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="p-1.5">
                    <span
                      className={`text-sm ${
                        isToday
                          ? "font-semibold text-teal-700"
                          : cell.inMonth
                            ? "text-slate-400"
                            : "text-slate-300"
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
    </section>
  );
}
