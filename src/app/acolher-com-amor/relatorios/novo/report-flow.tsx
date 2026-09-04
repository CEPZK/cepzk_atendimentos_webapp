"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AcaMonthCalendar,
  type AgendaDay,
} from "@/app/aca-month-calendar";
import {
  dayKey,
  formatLongDate,
  formatShortDate,
  formatTime,
  nameColor,
} from "@/lib/aca-agenda";
import { assistidoInitials } from "@/lib/assistido";
import {
  registerAcaRelatorios,
  type ReportSubmission,
} from "./actions";

/** Assistido agendado num dia, com a sessão que o relatório vai referenciar. */
export interface ReportCalendarAssistido {
  tratamentoId: number;
  sessaoId: number;
  nome: string;
  /** Indica se já existe relatório para esta sessão (não bloqueia novo). */
  hasRelatorio: boolean;
}

/** Dia do calendário com os assistidos agendados. */
export interface ReportCalendarDay {
  iso: string;
  assistidos: ReportCalendarAssistido[];
}

/** Voluntário escalado no Acolher com Amor (combobox de dirigente/ponte). */
export interface ReportVolunteer {
  id: string;
  nome: string;
}

interface ReportFlowProps {
  days: ReportCalendarDay[];
  volunteers: ReportVolunteer[];
}

/**
 * Fluxo de registro de relatório: o calendário do Acolher com Amor, e
 * para o dia escolhido, um diálogo com os assistidos daquele dia e o
 * formulário de ponte, dirigente e observações.
 */
export function ReportFlow({ days, volunteers }: ReportFlowProps) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const agendaDays: AgendaDay[] = useMemo(
    () =>
      days.map((day) => ({
        iso: day.iso,
        assistidos: day.assistidos.map((a) => a.nome),
      })),
    [days],
  );

  const byDay = useMemo(
    () => new Map(days.map((day) => [dayKey(day.iso), day])),
    [days],
  );

  const openDay = openKey ? byDay.get(openKey) : null;

  function handleSubmit(submissions: ReportSubmission[]) {
    setError(null);
    startTransition(async () => {
      const result = await registerAcaRelatorios(submissions);
      if (!result.ok) {
        setError(result.message ?? "Não foi possível registrar o relatório.");
        return;
      }
      setOpenKey(null);
      router.push("/acolher-com-amor/relatorios");
      router.refresh();
    });
  }

  return (
    <>
      <AcaMonthCalendar
        title="Escolha o dia da sessão"
        description="Os dias em destaque são os do Acolher com Amor."
        days={agendaDays}
        onSelectDay={setOpenKey}
      />

      {openDay && (
        <ReportDialog
          day={openDay}
          volunteers={volunteers}
          isPending={isPending}
          error={error}
          onClose={() => {
            if (!isPending) {
              setError(null);
              setOpenKey(null);
            }
          }}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}

/**
 * Diálogo aberto ao escolher um dia no calendário: lista os assistidos
 * agendados naquele dia e, para cada um, o formulário de ponte,
 * dirigente e observações. Os dois primeiros são obrigatórios; a
 * observação é opcional.
 */
function ReportDialog({
  day,
  volunteers,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  day: ReportCalendarDay;
  volunteers: ReportVolunteer[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (submissions: ReportSubmission[]) => void;
}) {
  // Estado do formulário: um Report por assistido.
  const [forms, setForms] = useState<Record<number, ReportFormState>>(() =>
    Object.fromEntries(
      day.assistidos.map((assistido) => [
        assistido.tratamentoId,
        {
          dirigenteId: "",
          ponteId: "",
          obs: "",
        },
      ]),
    ),
  );

  function update(tratamentoId: number, patch: Partial<ReportFormState>) {
    setForms((current) => ({
      ...current,
      [tratamentoId]: { ...current[tratamentoId], ...patch },
    }));
  }

  const allFilled = day.assistidos.every(
    (assistido) =>
      forms[assistido.tratamentoId]?.dirigenteId &&
      forms[assistido.tratamentoId]?.ponteId,
  );

  const someFilled = day.assistidos.some(
    (assistido) =>
      forms[assistido.tratamentoId]?.dirigenteId ||
      forms[assistido.tratamentoId]?.ponteId ||
      forms[assistido.tratamentoId]?.obs,
  );

  function submit() {
    if (day.assistidos.length === 0) {
      onClose();
      return;
    }

    const submissions: ReportSubmission[] = day.assistidos
      .map((assistido) => {
        const form = forms[assistido.tratamentoId];
        if (!form?.dirigenteId || !form?.ponteId) return null;
        return {
          sessaoId: assistido.sessaoId,
          tratamentoId: assistido.tratamentoId,
          dirigenteId: form.dirigenteId,
          ponteId: form.ponteId,
          obs: form.obs.trim(),
        };
      })
      .filter((s): s is ReportSubmission => s !== null);

    if (submissions.length === 0) return;
    onSubmit(submissions);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="relatorio-dia"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3
          id="relatorio-dia"
          className="text-base font-semibold text-slate-900 first-letter:uppercase"
        >
          {formatLongDate(day.iso)}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {formatShortDate(day.iso)} · {formatTime(day.iso)}
        </p>

        {day.assistidos.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Nenhum assistido agendado neste dia.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {day.assistidos.map((assistido) => {
              const form = forms[assistido.tratamentoId] ?? {
                dirigenteId: "",
                ponteId: "",
                obs: "",
              };
              const color = nameColor(assistido.nome).dot;
              return (
                <li
                  key={assistido.tratamentoId}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`}
                      aria-hidden="true"
                    />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-sky-700">
                      {assistidoInitials(assistido.nome)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                      {assistido.nome}
                    </span>
                    {assistido.hasRelatorio && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Já possui relatório
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-700">
                        Dirigente <span className="text-red-600">*</span>
                      </span>
                      <select
                        required
                        value={form.dirigenteId}
                        onChange={(event) =>
                          update(assistido.tratamentoId, {
                            dirigenteId: event.target.value,
                          })
                        }
                        disabled={isPending}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 disabled:opacity-60"
                      >
                        <option value="">Selecione…</option>
                        {volunteers.map((volunteer) => (
                          <option key={volunteer.id} value={volunteer.id}>
                            {volunteer.nome}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-slate-700">
                        Ponte <span className="text-red-600">*</span>
                      </span>
                      <select
                        required
                        value={form.ponteId}
                        onChange={(event) =>
                          update(assistido.tratamentoId, {
                            ponteId: event.target.value,
                          })
                        }
                        disabled={isPending}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 disabled:opacity-60"
                      >
                        <option value="">Selecione…</option>
                        {volunteers.map((volunteer) => (
                          <option key={volunteer.id} value={volunteer.id}>
                            {volunteer.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-3 block">
                    <span className="text-xs font-medium text-slate-700">
                      Observações
                    </span>
                    <textarea
                      value={form.obs}
                      onChange={(event) =>
                        update(assistido.tratamentoId, { obs: event.target.value })
                      }
                      disabled={isPending}
                      rows={3}
                      placeholder="Opcional"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 disabled:opacity-60"
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          {day.assistidos.length === 0 ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 sm:flex-1"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={submit}
                disabled={isPending || !allFilled}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
              >
                {isPending
                  ? "Salvando..."
                  : allFilled
                    ? "Salvar relatórios"
                    : someFilled
                      ? "Preencha os obrigatórios"
                      : "Preencha os relatórios"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 sm:flex-1"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ReportFormState {
  dirigenteId: string;
  ponteId: string;
  obs: string;
}
