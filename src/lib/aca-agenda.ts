/**
 * Acolher com Amor: the agenda of the sessions.
 *
 * The treatment starts on one of the days the atendimento actually
 * happens ("Sábado 9h30") and runs for three sessions, one every other
 * week. Nothing here is hardcoded to Saturday: the weekday and the time
 * are read from the atendimento's schedule name (`cepzk_horario.nome`),
 * so registering "Quarta-Feira 20h" for the ACA just works.
 */

/** How many sessions a treatment is scheduled with. */
export const SESSION_COUNT = 3;

/** One session every other week: skips one occurrence of the weekday. */
export const SESSION_INTERVAL_DAYS = 14;

/** How many upcoming dates the calendar offers. */
export const CALENDAR_OCCURRENCES = 8;

/**
 * The house is in Brazil and the schedule ("Sábado 9h30") has no time
 * zone: the dates are built in São Paulo time so that a server running
 * in UTC does not schedule Saturday 9h30 as Saturday 6h30.
 */
export const HOUSE_TIME_ZONE = "America/Sao_Paulo";

/** Fixed offset of `HOUSE_TIME_ZONE` (Brazil has no DST since 2019). */
const HOUSE_UTC_OFFSET = "-03:00";

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terca-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sabado",
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface HorarioSchedule {
  /** 0 = Sunday … 6 = Saturday, as in `Date.getDay()`. */
  weekday: number;
  hour: number;
  minute: number;
  /** "Sábado 9h30" — the catalogue name, kept for the screens. */
  label: string;
}

/**
 * Reads "Sábado 9h30" / "Sexta-Feira 19h" / "Quarta 20:15".
 *
 * Returns `null` when the name does not carry a weekday and a time —
 * the screen then says the atendimento has no schedule it can read,
 * instead of inventing dates.
 */
export function parseHorario(nome: string): HorarioSchedule | null {
  const normalized = normalize(nome);

  const weekday = WEEKDAYS.findIndex((day) => {
    // "Terça" matches "terca-feira" too: the seed writes both forms.
    const short = day.replace("-feira", "");
    return normalized.includes(day) || normalized.includes(short);
  });
  if (weekday === -1) return null;

  const time = normalized.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
  if (!time) return null;

  const hour = Number(time[1]);
  const minute = Number(time[2] ?? 0);
  if (hour > 23 || minute > 59) return null;

  return { weekday, hour, minute, label: nome };
}

/** The day part (`YYYY-MM-DD`) of an instant, in the house's time zone. */
function houseDayParts(instant: Date): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOUSE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(instant)
    .split("-")
    .map(Number);
  return { year, month, day };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** An instant from a house-local date + time. */
function houseInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${HOUSE_UTC_OFFSET}`,
  );
}

/**
 * The next `count` occurrences of the schedule, starting from `from`
 * (default: now). An occurrence that already happened today is skipped —
 * the team schedules ahead, never into the past.
 */
export function upcomingOccurrences(
  schedule: HorarioSchedule,
  count = CALENDAR_OCCURRENCES,
  from: Date = new Date(),
): Date[] {
  const today = houseDayParts(from);
  const base = houseInstant(
    today.year,
    today.month,
    today.day,
    schedule.hour,
    schedule.minute,
  );

  // Weekday of the house-local day (UTC math on the calendar date, so
  // the server's own time zone never shifts it).
  const start = new Date(
    Date.UTC(today.year, today.month - 1, today.day),
  ).getUTCDay();

  let delta = (schedule.weekday - start + 7) % 7;
  if (delta === 0 && base.getTime() <= from.getTime()) delta = 7;

  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(addDays(base, delta + i * 7));
  }
  return dates;
}

/** Same wall-clock time, `days` later. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * The three session dates of a treatment that starts on `first`: one
 * every `SESSION_INTERVAL_DAYS` days.
 */
export function sessionDates(
  first: Date,
  count = SESSION_COUNT,
  intervalDays = SESSION_INTERVAL_DAYS,
): Date[] {
  return Array.from({ length: count }, (_, index) =>
    addDays(first, index * intervalDays),
  );
}

const LONG_DATE = new Intl.DateTimeFormat("pt-BR", {
  timeZone: HOUSE_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "long",
});

const SHORT_DATE = new Intl.DateTimeFormat("pt-BR", {
  timeZone: HOUSE_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: HOUSE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** "sábado, 06 de setembro". */
export function formatLongDate(date: Date | string): string {
  return LONG_DATE.format(new Date(date));
}

/** "06/09/2026". */
export function formatShortDate(date: Date | string): string {
  return SHORT_DATE.format(new Date(date));
}

/** "09:30". */
export function formatTime(date: Date | string): string {
  return TIME.format(new Date(date));
}

/** Key used to group the sessions already booked by day. */
export function dayKey(date: Date | string): string {
  const parts = houseDayParts(new Date(date));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Whether an instant falls on the weekday and time of the schedule. */
export function matchesSchedule(
  date: Date,
  schedule: HorarioSchedule,
): boolean {
  const parts = houseDayParts(date);
  const weekday = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  ).getUTCDay();

  return (
    weekday === schedule.weekday &&
    houseInstant(
      parts.year,
      parts.month,
      parts.day,
      schedule.hour,
      schedule.minute,
    ).getTime() === date.getTime()
  );
}
