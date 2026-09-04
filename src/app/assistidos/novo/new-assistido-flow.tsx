"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  assistidoInitials,
  type CatalogItem,
  type SimilarAssistido,
  type TreatmentInput,
} from "@/lib/assistido";
import type { AtendimentoItem } from "@/lib/atendimento";
import { ChevronRightIcon, PlusIcon } from "@/app/icons";
import { createAssistido, findSimilarAssistidos } from "../actions";
import {
  emptyTreatment,
  FIELD_CLASS,
  TreatmentFields,
} from "@/app/treatment-fields";

type Step = "nome" | "similares" | "cadastro";

const PRIMARY_BUTTON =
  "w-full rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const SECONDARY_BUTTON =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

interface NewAssistidoFlowProps {
  atendimentos: AtendimentoItem[];
  distonias: CatalogItem[];
  queixas: CatalogItem[];
}

/**
 * Registering an assistido, in three steps: the full name, the check for
 * names already in the system, and the registration itself.
 *
 * The middle step is the point of the whole flow — registering the same
 * person twice splits their history in two.
 */
export function NewAssistidoFlow({
  atendimentos,
  distonias,
  queixas,
}: NewAssistidoFlowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("nome");
  const [nome, setNome] = useState("");
  const [matches, setMatches] = useState<SimilarAssistido[]>([]);
  const [treatments, setTreatments] = useState<TreatmentInput[]>([
    emptyTreatment(),
  ]);
  const [error, setError] = useState<string | null>(null);

  function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await findSimilarAssistidos(nome);
      if (!result.ok) {
        setError(result.message ?? "Não foi possível consultar os nomes.");
        return;
      }
      setMatches(result.matches);
      // Nothing alike in the system: no point in asking to double-check.
      setStep(result.matches.length > 0 ? "similares" : "cadastro");
    });
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createAssistido({
        nomeCompleto: nome,
        treatments,
      });

      if (!result.ok || !result.id) {
        setError(result.message ?? "Não foi possível cadastrar.");
        return;
      }

      router.push(`/assistidos/${result.id}`);
      router.refresh();
    });
  }

  const errorBox = error && (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {error}
    </p>
  );

  if (step === "nome") {
    return (
      <>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          Cadastrar assistido
        </h1>

        <form
          onSubmit={handleNameSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          noValidate
        >
          <div>
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
              autoFocus
              autoComplete="off"
              placeholder="Nome completo do assistido"
              className={FIELD_CLASS}
            />
          </div>

          {errorBox}

          <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
            {isPending ? "Consultando..." : "OK"}
          </button>
          <Link href="/assistidos" className={`${SECONDARY_BUTTON} block text-center`}>
            Cancelar
          </Link>
        </form>
      </>
    );
  }

  if (step === "similares") {
    return (
      <>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          Cadastrar assistido
        </h1>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="rounded-xl border-2 border-sky-600 bg-sky-50 px-4 py-3 text-base font-semibold text-sky-900">
            {nome}
          </p>

          <p className="mt-4 text-sm leading-relaxed text-slate-700">
            Encontrei esses nomes no sistema. Por favor, verifique se o
            assistido já não está cadastrado.
          </p>

          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {matches.map((match) => (
              <li key={match.id}>
                <Link
                  href={`/assistidos/${match.id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-600"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                    {assistidoInitials(match.nome_completo)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {match.nome_completo}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {match.reason}
                    </span>
                  </span>
                  <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => setStep("cadastro")}
              className={PRIMARY_BUTTON}
            >
              Cadastrar Novo
            </button>
            <button
              type="button"
              onClick={() => {
                setMatches([]);
                setStep("nome");
              }}
              className={SECONDARY_BUTTON}
            >
              Cancelar
            </button>
          </div>
        </section>
      </>
    );
  }

  // One treatment per atendimento: adding more than the catalogue holds
  // would only produce duplicates.
  const usedAtendimentos = new Set(
    treatments.map((treatment) => treatment.atendimentoId).filter(Boolean),
  );
  const canAddTreatment = usedAtendimentos.size < atendimentos.length;

  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Cadastrar assistido
      </h1>

      <form onSubmit={handleCreate} className="mt-6 space-y-6" noValidate>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label
            htmlFor="nome-cadastro"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Nome completo
          </label>
          <input
            id="nome-cadastro"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            autoComplete="off"
            className={FIELD_CLASS}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Tratamentos
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            O assistido precisa de ao menos um tratamento.
          </p>

          <ul className="mt-4 space-y-4">
            {treatments.map((treatment, index) => (
              <TreatmentFields
                key={index}
                index={index}
                treatment={treatment}
                atendimentos={atendimentos}
                distonias={distonias}
                queixas={queixas}
                canRemove={treatments.length > 1}
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

        {errorBox}

        <div className="space-y-3">
          <button type="submit" disabled={isPending} className={PRIMARY_BUTTON}>
            {isPending ? "Cadastrando..." : "Cadastrar assistido"}
          </button>
          <Link href="/assistidos" className={`${SECONDARY_BUTTON} block text-center`}>
            Cancelar
          </Link>
        </div>
      </form>
    </>
  );
}
