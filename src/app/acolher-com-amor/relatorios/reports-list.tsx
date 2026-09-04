"use client";

import { useMemo, useState } from "react";
import {
  formatLongDate,
  formatShortDate,
  formatTime,
} from "@/lib/aca-agenda";
import { assistidoInitials, normalizeName } from "@/lib/assistido";
import { ChevronRightIcon, SearchIcon } from "@/app/icons";
import type { AcaRelatorio } from "@/lib/aca-relatorio";

/**
 * Lista de relatórios do Acolher com Amor: ordenada pela data da sessão
 * (mais nova → mais antiga) com busca por nome do assistido no topo.
 *
 * Cada item abre um diálogo com o detalhe (procedimentos, ponte,
 * dirigente e observações da sessão).
 */
export function ReportsList({
  relatorios,
}: {
  relatorios: AcaRelatorio[];
}) {
  const [query, setQuery] = useState("");
  const [openRelatorio, setOpenRelatorio] = useState<AcaRelatorio | null>(
    null,
  );

  const results = useMemo(() => {
    const terms = normalizeName(query).split(" ").filter(Boolean);
    if (terms.length === 0) return relatorios;
    return relatorios.filter((relatorio) => {
      const name = normalizeName(relatorio.assistidoNome);
      return terms.every((term) => name.includes(term));
    });
  }, [relatorios, query]);

  return (
    <div className="mt-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome do assistido"
          aria-label="Buscar relatório por nome do assistido"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
        />
      </div>

      <p className="mt-4 text-xs text-slate-500">
        {results.length} de {relatorios.length}{" "}
        {relatorios.length === 1 ? "relatório" : "relatórios"}
      </p>

      <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {results.map((relatorio) => (
          <li key={relatorio.id}>
            <button
              type="button"
              onClick={() => setOpenRelatorio(relatorio)}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-700">
                {assistidoInitials(relatorio.assistidoNome)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {relatorio.assistidoNome}
                </span>
                <span className="block truncate text-xs text-slate-500 first-letter:uppercase">
                  {formatLongDate(relatorio.data)} ·{" "}
                  {formatTime(relatorio.data)}
                </span>
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </button>
          </li>
        ))}

        {results.length === 0 && (
          <li className="p-6 text-center text-sm leading-relaxed text-slate-500">
            {relatorios.length === 0
              ? "Nenhum relatório registrado ainda."
              : `Nenhum relatório encontrado para "${query}".`}
          </li>
        )}
      </ul>

      {openRelatorio && (
        <RelatorioDialog
          relatorio={openRelatorio}
          onClose={() => setOpenRelatorio(null)}
        />
      )}
    </div>
  );
}

/**
 * Diálogo com os detalhes de um relatório:
 * nome do assistido, tratamentos, data da sessão, procedimentos,
 * dirigente, ponte e observações.
 */
function RelatorioDialog({
  relatorio,
  onClose,
}: {
  relatorio: AcaRelatorio;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="relatorio-detalhe"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
          Relatório
        </p>
        <h3
          id="relatorio-detalhe"
          className="mt-1 text-base font-semibold text-slate-900"
        >
          {relatorio.assistidoNome}
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 first-letter:uppercase">
          {formatLongDate(relatorio.data)} · {formatShortDate(relatorio.data)} ·{" "}
          {formatTime(relatorio.data)}
        </p>

        {relatorio.tratamentos.length > 0 && (
          <section className="mt-5">
            <p className="text-xs font-medium text-slate-500">Tratamentos</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {relatorio.tratamentos.map((tratamento) => (
                <li
                  key={tratamento}
                  className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700"
                >
                  {tratamento}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-5">
          <p className="text-xs font-medium text-slate-500">
            Procedimentos utilizados na sessão
          </p>
          {relatorio.procedimentos.length > 0 ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {relatorio.procedimentos.map((procedimento) => (
                <li
                  key={procedimento}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                >
                  {procedimento}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Nenhum procedimento registrado.
            </p>
          )}
        </section>

        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Dirigente</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {relatorio.dirigenteNome}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Ponte</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {relatorio.ponteNome}
            </dd>
          </div>
        </dl>

        {relatorio.obs && (
          <section className="mt-5">
            <p className="text-xs font-medium text-slate-500">Observações</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {relatorio.obs}
            </p>
          </section>
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
