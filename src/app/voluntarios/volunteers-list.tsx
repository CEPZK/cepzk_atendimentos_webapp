"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  fullName,
  initials,
  ROLE_LABELS,
  type Volunteer,
} from "@/lib/volunteer";
import { ChevronRightIcon, SearchIcon } from "@/app/icons";

/** Removes accents so "jose" also finds "José". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function VolunteersList({ volunteers }: { volunteers: Volunteer[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return volunteers;

    return volunteers.filter((volunteer) => {
      const haystack = normalize(
        [
          volunteer.nome,
          volunteer.sobrenome,
          volunteer.email,
          volunteer.telefone,
          ROLE_LABELS[volunteer.papel],
        ]
          .filter(Boolean)
          .join(" "),
      );
      return terms.every((term) => haystack.includes(term));
    });
  }, [volunteers, query]);

  return (
    <div className="mt-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nome, e-mail ou telefone"
          aria-label="Buscar voluntário"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
        />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {results.length} de {volunteers.length}{" "}
        {volunteers.length === 1 ? "voluntário" : "voluntários"}
      </p>

      <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {results.map((volunteer) => (
          <li key={volunteer.id}>
            <Link
              href={`/voluntarios/${volunteer.id}`}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-700">
                {initials(volunteer)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {fullName(volunteer) || volunteer.email}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {volunteer.email}
                </span>
              </span>
              {volunteer.papel !== "colaborador" && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {ROLE_LABELS[volunteer.papel]}
                </span>
              )}
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          </li>
        ))}

        {results.length === 0 && (
          <li className="p-6 text-center text-sm text-slate-500">
            Nenhum voluntário encontrado para “{query}”.
          </li>
        )}
      </ul>
    </div>
  );
}
