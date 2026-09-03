import Link from "next/link";
import { assistidoInitials, type AcaWaitlistItem } from "@/lib/assistido";
import { ChevronRightIcon } from "@/app/icons";

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * The Acolher com Amor waiting list: read-only, ordered by how long each
 * assistido has been waiting (most recent update to their pendente
 * treatment first — see `buildAcaWaitlist`).
 */
export function WaitlistList({
  assistidos,
}: {
  assistidos: AcaWaitlistItem[];
}) {
  return (
    <div className="mt-4">
      <p className="text-xs text-slate-500">
        {assistidos.length}{" "}
        {assistidos.length === 1 ? "assistido" : "assistidos"} na espera
      </p>

      <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {assistidos.map((assistido) => (
          <li key={assistido.id}>
            <Link
              href={`/assistidos/${assistido.id}`}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-semibold text-teal-700">
                {assistidoInitials(assistido.nome_completo)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {assistido.nome_completo}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  Atualizado em{" "}
                  {DATE_FORMAT.format(new Date(assistido.dataAtualizacao))}
                </span>
              </span>
              <ChevronRightIcon className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          </li>
        ))}

        {assistidos.length === 0 && (
          <li className="p-6 text-center text-sm leading-relaxed text-slate-500">
            Ninguém está esperando pelo Acolher com Amor no momento.
          </li>
        )}
      </ul>
    </div>
  );
}
