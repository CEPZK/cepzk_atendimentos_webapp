"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  assistidoInitials,
  normalizeName,
  type Assistido,
} from "@/lib/assistido";
import { ChevronRightIcon, PlusIcon, SearchIcon } from "@/app/icons";

export function AssistidosList({ assistidos }: { assistidos: Assistido[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const terms = normalizeName(query).split(" ").filter(Boolean);
    if (terms.length === 0) return assistidos;

    return assistidos.filter((assistido) => {
      const name = normalizeName(assistido.nome_completo);
      return terms.every((term) => name.includes(term));
    });
  }, [assistidos, query]);

  return (
    <div className="mt-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome"
          aria-label="Buscar assistido"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
        />
      </div>

      <Link
        href="/assistidos/novo"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
      >
        <PlusIcon className="h-5 w-5" />
        Cadastrar assistido
      </Link>

      <p className="mt-4 text-xs text-slate-500">
        {results.length} de {assistidos.length}{" "}
        {assistidos.length === 1 ? "assistido" : "assistidos"}
      </p>

      <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {results.map((assistido) => (
          <li key={assistido.id}>
            <Link
              href={`/assistidos/${assistido.id}`}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-700">
                {assistidoInitials(assistido.nome_completo)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                {assistido.nome_completo}
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          </li>
        ))}

        {results.length === 0 && (
          <li className="p-6 text-center text-sm leading-relaxed text-slate-500">
            {assistidos.length === 0
              ? "Nenhum assistido cadastrado ainda."
              : `Nenhum assistido encontrado para “${query}”.`}
          </li>
        )}
      </ul>
    </div>
  );
}
