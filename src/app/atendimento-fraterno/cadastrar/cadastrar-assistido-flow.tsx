"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  assistidoInitials,
  type CatalogItem,
  type SimilarAssistido,
} from "@/lib/assistido";
import type { AtendimentoItem } from "@/lib/atendimento";
import { ChevronRightIcon } from "@/app/icons";
import { findSimilarAssistidos } from "@/app/assistidos/actions";
import { FIELD_CLASS } from "@/app/treatment-fields";
import { CadastroAssistidoForm } from "./cadastro-assistido-form";

type Step = "nome" | "similares" | "cadastro";

const PRIMARY_BUTTON =
  "w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const SECONDARY_BUTTON =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

interface CadastrarAssistidoFlowProps {
  atendimentos: AtendimentoItem[];
  distonias: CatalogItem[];
  queixas: CatalogItem[];
}

/**
 * The Atendimento Fraterno's registration, in three steps: the full name,
 * the check for names already in the system, and the registration itself.
 *
 * The middle step is the point of the whole flow: registering the same
 * person twice splits their history in two — so the volunteer either
 * picks an existing assistido (to continue their cadastro) or proceeds
 * with the name just typed.
 */
export function CadastrarAssistidoFlow({
  atendimentos,
  distonias,
  queixas,
}: CadastrarAssistidoFlowProps) {
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("nome");
  const [nome, setNome] = useState("");
  const [matches, setMatches] = useState<SimilarAssistido[]>([]);
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
          <Link href="/" className={`${SECONDARY_BUTTON} block text-center`}>
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
          <p className="rounded-xl border-2 border-sky-500 bg-sky-50 px-4 py-3 text-base font-semibold text-sky-800">
            {nome}
          </p>

          <p className="mt-4 text-sm leading-relaxed text-slate-700">
            Encontrei esses nomes no sistema. Escolha um assistido já
            cadastrado para continuar o cadastro dele, ou siga com o nome
            digitado.
          </p>

          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {matches.map((match) => (
              <li key={match.id}>
                <Link
                  href={`/atendimento-fraterno/cadastrar/${match.id}`}
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
              Continuar o Cadastro
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

  return (
    <>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
        Cadastrar assistido
      </h1>

      <CadastroAssistidoForm
        assistido={null}
        existingTreatments={[]}
        initialName={nome}
        atendimentos={atendimentos}
        distonias={distonias}
        queixas={queixas}
      />
    </>
  );
}
