"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CatalogItem } from "@/lib/assistido";
import {
  formatLongDate,
  formatShortDate,
  formatTime,
  isOnDay,
} from "@/lib/aca-agenda";
import {
  SessionProceduresFields,
  type SessionProcedures,
} from "@/app/session-procedures-fields";
import {
  TreatmentSummaryCard,
  type TreatmentSummary,
} from "@/app/treatment-summary-card";
import { updateAcaTreatmentProcedures } from "../../../assistidos/actions";

/** One scheduled session of the treatment, as loaded from the calendar. */
export interface EditableSession {
  sessaoId: number;
  /** Instant of the session, in ISO. */
  data: string;
  procedimentoIds: number[];
}

interface TreatmentSessionsEditorProps {
  treatmentId: number;
  assistidoNome: string;
  sessions: EditableSession[];
  treatment: TreatmentSummary;
  procedimentos: CatalogItem[];
  /**
   * `YYYY-MM-DD` key of the current day in the house's time zone, given by
   * the page: the session that falls on it is highlighted.
   */
  today: string;
}

interface SessionState {
  sessaoId: number;
  data: string;
  procedimentos: SessionProcedures;
}

/**
 * The treatment of an assistido already scheduled, opened from the
 * calendar: the same screen as the treatment start, but loaded with the
 * existing sessions. Procedures can be changed, removed and added, and
 * the session of the current day — when there is one — is highlighted.
 */
export function TreatmentSessionsEditor({
  treatmentId,
  assistidoNome,
  sessions,
  treatment,
  procedimentos,
  today,
}: TreatmentSessionsEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<SessionState[]>(() =>
    sessions.map((session) => ({
      sessaoId: session.sessaoId,
      data: session.data,
      // An empty session keeps one blank row, so there is always a select
      // to add a procedure.
      procedimentos:
        session.procedimentoIds.length > 0
          ? [...session.procedimentoIds]
          : [null],
    })),
  );
  const [error, setError] = useState<string | null>(null);

  function updateSession(index: number, next: SessionProcedures) {
    setState((current) =>
      current.map((session, i) =>
        i === index ? { ...session, procedimentos: next } : session,
      ),
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateAcaTreatmentProcedures({
        treatmentId,
        sessions: state.map((session) => ({
          sessaoId: session.sessaoId,
          procedimentoIds: session.procedimentos.filter(
            (id): id is number => id !== null,
          ),
        })),
      });

      if (!result.ok) {
        setError(result.message ?? "Não foi possível salvar.");
        return;
      }

      router.push("/acolher-com-amor/calendario");
      router.refresh();
    });
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          Sessões de {assistidoNome}
        </h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Altere, remova ou adicione os procedimentos de cada sessão.
      </p>

      <TreatmentSummaryCard treatment={treatment} />

      <ol className="mt-4 space-y-3">
        {state.map((session, index) => {
          // A sessão do dia corrente ganha destaque: é a que o voluntário
          // procura ao abrir a tela no próprio dia do atendimento.
          const isToday = isOnDay(session.data, today);

          return (
            <li
              key={session.sessaoId}
              aria-current={isToday ? "date" : undefined}
              className={`rounded-2xl border p-4 shadow-sm ${
                isToday
                  ? "border-teal-300 bg-teal-50/70 ring-1 ring-inset ring-teal-200"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 first-letter:uppercase">
                  {index + 1}ª sessão — {formatLongDate(session.data)}
                </p>
                {isToday && (
                  <span className="rounded-full bg-teal-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                    Hoje
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {formatShortDate(session.data)} · {formatTime(session.data)}
              </p>

              <SessionProceduresFields
                procedimentos={procedimentos}
                value={session.procedimentos}
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
        onClick={save}
        disabled={isPending}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isPending ? "Salvando..." : "Salvar"}
      </button>
    </section>
  );
}
