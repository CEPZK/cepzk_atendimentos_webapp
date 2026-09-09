import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSector } from "@/lib/current-volunteer";
import { ACA_SECTOR } from "@/lib/assistido";
import { formatLongDate, formatShortDate, formatTime } from "@/lib/aca-agenda";
import { ArrowLeftIcon } from "@/app/icons";
import {
  TreatmentSummaryDetails,
  isTreatmentSummaryEmpty,
} from "@/app/treatment-summary-card";
import { loadRelatorio } from "../queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Relatório — Acolher com Amor",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/** O card de cada bloco do relatório, como nas outras telas de detalhe. */
const CARD_CLASS =
  "mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

/**
 * O relatório de uma sessão em tela inteira — antes era um pop-up na
 * lista, apertado demais para o que precisa ser lido.
 *
 * Além do que a sessão registrou (procedimentos, dirigente, ponte e
 * observações), a tela traz os dados do assistido que o cadastro
 * registrou: distonia, queixas e observações, mais as assistências que
 * ele tem nos outros setores. Tudo numa leitura só.
 */
export default async function RelatorioPage({ params }: PageProps) {
  const { id } = await params;
  // O id vem da URL: sem ser número, não há o que buscar no banco.
  if (!/^\d+$/.test(id)) {
    notFound();
  }

  // Só o time do Acolher com Amor (e o admin) lê os relatórios.
  const { supabase } = await requireSector(ACA_SECTOR);
  const { relatorio, error } = await loadRelatorio(supabase, id);

  if (!relatorio) {
    if (error) {
      return (
        <main className="mx-auto w-full max-w-2xl flex-1 p-6">
          <BackLink />
          <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Não foi possível carregar o relatório ({error.code}: {error.message}
            ).
          </p>
        </main>
      );
    }
    notFound();
  }

  const assistidoSummary = {
    distonia: relatorio.distonia,
    queixas: relatorio.queixas,
    obs: relatorio.obsCadastro,
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <BackLink />

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-sky-700">
        Relatório
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
        {relatorio.assistidoNome}
      </h1>
      <p className="mt-1 text-sm text-slate-500 first-letter:uppercase">
        {formatLongDate(relatorio.data)} · {formatShortDate(relatorio.data)} ·{" "}
        {formatTime(relatorio.data)}
      </p>

      <section className={CARD_CLASS}>
        <h2 className="text-base font-semibold text-slate-900">
          Dados do assistido
        </h2>

        {isTreatmentSummaryEmpty(assistidoSummary) ? (
          <p className="mt-3 text-sm text-slate-500">
            Nada registrado no cadastro deste assistido.
          </p>
        ) : (
          <TreatmentSummaryDetails treatment={assistidoSummary} />
        )}
      </section>

      <section className={CARD_CLASS}>
        <h2 className="text-base font-semibold text-slate-900">Sessão</h2>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Dirigente</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {relatorio.dirigenteNome}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Ponte</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {relatorio.ponteNome}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
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
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">Observações da sessão</p>
          {relatorio.obs ? (
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
              {relatorio.obs}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-slate-500">
              Nenhuma observação registrada.
            </p>
          )}
        </div>
      </section>

      <section className={CARD_CLASS}>
        <h2 className="text-base font-semibold text-slate-900">
          Assistências
          {relatorio.tratamentos.length > 0 &&
            ` (${relatorio.tratamentos.length})`}
        </h2>

        {relatorio.tratamentos.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {relatorio.tratamentos.map((tratamento) => (
              <li
                key={tratamento}
                className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
              >
                {tratamento}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Nenhuma assistência registrada.
          </p>
        )}
      </section>
    </main>
  );
}

/** Volta para a lista de relatórios. */
function BackLink() {
  return (
    <Link
      href="/acolher-com-amor/relatorios"
      className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-sky-700"
    >
      <ArrowLeftIcon className="h-4 w-4" />
      Relatório de Atendimentos
    </Link>
  );
}
