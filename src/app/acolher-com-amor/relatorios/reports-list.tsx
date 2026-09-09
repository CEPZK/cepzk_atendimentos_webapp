"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatLongDate, formatTime } from "@/lib/aca-agenda";
import { assistidoInitials, normalizeName } from "@/lib/assistido";
import { ChevronRightIcon, SearchIcon } from "@/app/icons";
import type { AcaRelatorio } from "@/lib/aca-relatorio";

/**
 * Lista de relatórios do Acolher com Amor: ordenada pela data da sessão
 * (mais nova → mais antiga) com busca por nome do assistido no topo.
 *
 * Cada item abre a tela inteira do relatório (`/relatorios/[id]`), com os
 * dados da sessão e os dados do assistido — o detalhe era um pop-up,
 * apertado demais para tudo o que precisa ser lido.
 */
export function ReportsList({
  relatorios,
}: {
  relatorios: AcaRelatorio[];
}) {
  const [query, setQuery] = useState("");

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
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30"
        />
      </div>

      <p className="mt-4 text-xs text-slate-500">
        {results.length} de {relatorios.length}{" "}
        {relatorios.length === 1 ? "relatório" : "relatórios"}
      </p>

      <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {results.map((relatorio) => (
          <li key={relatorio.id}>
            <Link
              href={`/acolher-com-amor/relatorios/${relatorio.id}`}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-600"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-700">
                {assistidoInitials(relatorio.assistidoNome)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {relatorio.assistidoNome}
                </span>
                <span className="block truncate text-xs text-slate-500 first-letter:uppercase">
                  {formatLongDate(relatorio.data)} · {formatTime(relatorio.data)}
                </span>
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
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
    </div>
  );
}
