"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  treatmentStateChip,
  treatmentStateColorClass,
  type CatalogItem,
  type TreatmentInput,
} from "@/lib/assistido";
import type { AtendimentoItem } from "@/lib/atendimento";
import { CheckIcon, PlusIcon, PuzzlePieceIcon } from "@/app/icons";
import { createAssistido } from "@/app/assistidos/actions";
import {
  emptyTreatment,
  FIELD_CLASS,
  TreatmentFields,
} from "@/app/treatment-fields";
import { saveAssistido } from "./actions";

const PRIMARY_BUTTON =
  "w-full rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const SECONDARY_BUTTON =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

/** A treatment the assistido already has: read-only on this screen. */
export interface ExistingTreatmentView {
  id: number;
  atendimentoId: number | null;
  setor: string;
  horario: string;
  precedencia: number | null;
  estado: string;
  archived: boolean;
  obs: string | null;
  /** Acolher com Amor only. */
  distonia: string | null;
  queixas: string[];
}

interface CadastroAssistidoFormProps {
  /**
   * The assistido being edited, or `null` to register a new one with the
   * name typed in the previous step.
   */
  assistido: { id: number; nomeCompleto: string; archived: boolean } | null;
  /** Treatments the assistido already has (read-only). */
  existingTreatments: ExistingTreatmentView[];
  /** The name typed on the search step, for a brand-new assistido. */
  initialName?: string;
  atendimentos: AtendimentoItem[];
  distonias: CatalogItem[];
  queixas: CatalogItem[];
}

/**
 * The registration screen of the Atendimento Fraterno, shared by the two
 * paths: a brand-new assistido (like the admins' screen) or an existing
 * one. For the existing one the name can be changed and new treatments
 * added, but the registered treatments are read-only — and repeating an
 * atendimento is only allowed while its existing treatments are archived.
 */
export function CadastroAssistidoForm({
  assistido,
  existingTreatments,
  initialName,
  atendimentos,
  distonias,
  queixas,
}: CadastroAssistidoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [nome, setNome] = useState(
    assistido?.nomeCompleto ?? initialName ?? "",
  );
  const [treatments, setTreatments] = useState<TreatmentInput[]>([
    emptyTreatment(),
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Atendimentos cujo tratamento ativo não pode ser repetido: eles não
  // entram nas opções dos novos tratamentos.
  const activeExistingIds = useMemo(
    () =>
      new Set(
        existingTreatments
          .filter(
            (treatment) =>
              !treatment.archived && treatment.atendimentoId !== null,
          )
          .map((treatment) => treatment.atendimentoId as number),
      ),
    [existingTreatments],
  );

  const availableAtendimentos = useMemo(
    () => atendimentos.filter((item) => !activeExistingIds.has(item.id)),
    [atendimentos, activeExistingIds],
  );

  // One treatment per atendimento among the new rows: adding more than
  // the (available) catalogue holds would only produce duplicates.
  const usedAtendimentos = new Set(
    treatments.map((treatment) => treatment.atendimentoId).filter(Boolean),
  );
  const canAddTreatment = usedAtendimentos.size < availableAtendimentos.length;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      // Editando, as linhas novas ainda vazias não contam: salvar só o
      // nome (e o desarquivamento) é um cadastro válido. Uma linha com
      // observação mas sem atendimento continua indo — o servidor aponta
      // o que falta.
      const newTreatments = assistido
        ? treatments.filter(
            (treatment) =>
              treatment.atendimentoId !== null ||
              treatment.obs.trim() !== "",
          )
        : treatments;

      const result = assistido
        ? await saveAssistido({
            assistidoId: assistido.id,
            nomeCompleto: nome,
            treatments: newTreatments,
          })
        : await createAssistido({ nomeCompleto: nome, treatments: newTreatments });

      if (!result.ok) {
        setError(result.message ?? "Não foi possível salvar.");
        return;
      }

      setSaved(result.message ?? "Cadastro salvo.");
      router.refresh();
    });
  }

  if (saved) {
    return (
      <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <p className="flex items-start gap-2.5 text-sm font-medium text-emerald-900">
          <CheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          {saved}
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push("/atendimento-fraterno/cadastrar")}
            className={PRIMARY_BUTTON}
          >
            Cadastrar outro assistido
          </button>
          <Link href="/" className={`${SECONDARY_BUTTON} block text-center`}>
            Voltar ao início
          </Link>
        </div>
      </section>
    );
  }

  const errorBox = error && (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {error}
    </p>
  );

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label
          htmlFor="nome-completo"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Nome completo
        </label>
        <input
          id="nome-completo"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          autoFocus={!assistido}
          autoComplete="off"
          placeholder="Nome completo do assistido"
          className={FIELD_CLASS}
        />

        {assistido?.archived && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
            Este assistido está arquivado. Ao salvar, ele volta a ficar
            ativo — os tratamentos arquivados continuam arquivados.
          </p>
        )}
      </section>

      {assistido && existingTreatments.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Tratamentos já registrados
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Estes tratamentos não podem ser removidos por aqui.
          </p>

          <ul className="mt-4 space-y-3">
            {existingTreatments.map((treatment) => (
              <li
                key={treatment.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {treatment.setor}
                  </span>
                  <span className="text-xs text-slate-500">
                    {treatment.horario}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${treatmentStateColorClass(treatment.estado)}`}
                  >
                    {treatmentStateChip(treatment.estado)}
                  </span>
                  {treatment.archived && (
                    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                      Arquivado
                    </span>
                  )}
                </div>

                {treatment.distonia && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                    <PuzzlePieceIcon className="h-4 w-4 shrink-0 text-sky-700" />
                    <span>
                      <span className="text-slate-500">
                        Distonia relatada:{" "}
                      </span>
                      {treatment.distonia}
                    </span>
                  </p>
                )}

                {treatment.queixas.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500">
                      Principais queixas
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {treatment.queixas.map((queixa) => (
                        <li
                          key={queixa}
                          className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
                        >
                          {queixa}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {treatment.obs && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">Observações</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                      {treatment.obs}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(!assistido || availableAtendimentos.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            {assistido ? "Novos tratamentos" : "Tratamentos"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {assistido
              ? "Inclua os novos tratamentos do assistido."
              : "O assistido precisa de ao menos um tratamento."}
          </p>
          {activeExistingIds.size > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Atendimentos que já têm um tratamento ativo não podem ser
              repetidos e não aparecem nas opções.
            </p>
          )}

          <ul className="mt-4 space-y-4">
            {treatments.map((treatment, index) => (
              <TreatmentFields
                key={index}
                index={index}
                treatment={treatment}
                atendimentos={availableAtendimentos}
                distonias={distonias}
                queixas={queixas}
                // Novo cadastro: ao menos um tratamento tem de sobrar.
                // Editando: as linhas novas podem ser todas removidas,
                // os tratamentos registrados continuam valendo.
                canRemove={assistido ? true : treatments.length > 1}
                onChange={(next) =>
                  setTreatments((current) =>
                    current.map((item, position) =>
                      position === index ? next : item,
                    ),
                  )
                }
                onRemove={() =>
                  setTreatments((current) =>
                    current.filter((_, position) => position !== index),
                  )
                }
              />
            ))}
          </ul>

          {canAddTreatment && (
            <button
              type="button"
              onClick={() =>
                setTreatments((current) => [...current, emptyTreatment()])
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-sky-400 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600"
            >
              <PlusIcon className="h-5 w-5" />
              Adicionar tratamento
            </button>
          )}
        </section>
      )}

      {assistido && availableAtendimentos.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm leading-relaxed text-slate-500">
          Todos os atendimentos já têm um tratamento ativo: não há novos
          tratamentos para incluir agora.
        </p>
      )}

      {errorBox}

      <div className="space-y-3">
        <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
          {isPending
            ? "Salvando..."
            : assistido
              ? "Salvar alterações"
              : "Cadastrar assistido"}
        </button>
        <Link href="/" className={`${SECONDARY_BUTTON} block text-center`}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
