import type { Metadata } from "next";
import { FeatureCard } from "@/app/feature-card";
import { ListHeartIcon, UserPlusIcon } from "@/app/icons";

// TEMPORARY DESIGN PREVIEW — compares header variants for the home screen.
// Removed as soon as the chosen variant is implemented.
export const metadata: Metadata = {
  title: "Prévia — cabeçalho do Início",
};

const VOLUNTEER = {
  nome: "Mariana",
  sobrenome: "Almeida",
  papel: "Coordenador",
  setores: ["Acolher com Amor", "Desobsessão Infantil I"],
};

const CARDS = [
  {
    key: "cadastrar",
    href: "/atendimento-fraterno/cadastrar",
    title: "Cadastrar Assistido",
    description:
      "Registrar um novo assistido ou continuar o cadastro de um já existente.",
    icon: <UserPlusIcon />,
  },
  {
    key: "lista-espera",
    href: "/acolher-com-amor/lista-de-espera",
    title: "Lista de Espera para o Acolher com Amor",
    description:
      "Consultar os assistidos cuja próxima assistência é o Acolher com Amor.",
    icon: <ListHeartIcon />,
  },
];

function CardsSample() {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-medium text-slate-500">
        O que você pode fazer
      </h2>
      <div className="mt-3 grid gap-3">
        {CARDS.map((card) => (
          <FeatureCard
            key={card.key}
            href={card.href}
            title={card.title}
            description={card.description}
            icon={card.icon}
          />
        ))}
      </div>
    </section>
  );
}

function Frame({
  label,
  summary,
  children,
}: {
  label: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{summary}</p>
      </div>
      <div className="mt-3 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
        {children}
      </div>
    </section>
  );
}

/** Variant A: native-looking sticky app bar. */
function VariantA() {
  return (
    <div>
      <header className="border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white">
            MA
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Bom dia
            </p>
            <p className="truncate text-base font-semibold text-slate-900">
              {VOLUNTEER.nome}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>
        </div>
      </header>
      <div className="px-5 py-4">
        <p className="text-sm text-slate-500">
          {VOLUNTEER.papel} · {VOLUNTEER.setores.length} setores
        </p>
        <CardsSample />
      </div>
    </div>
  );
}

/** Variant B: profile hero card with the chips kept inside it. */
function VariantB() {
  return (
    <div className="p-5">
      <section className="rounded-3xl bg-gradient-to-br from-sky-600 to-sky-800 p-5 text-white shadow-lg shadow-sky-900/15">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-base font-semibold ring-1 ring-white/30">
            MA
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sky-100/80">
              Bem-vindo
            </p>
            <h1 className="truncate text-xl font-semibold">
              {VOLUNTEER.nome}
            </h1>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-sky-800">
            {VOLUNTEER.papel}
          </span>
          {VOLUNTEER.setores.map((sector) => (
            <span
              key={sector}
              className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/20"
            >
              {sector}
            </span>
          ))}
        </div>
      </section>
      <CardsSample />
    </div>
  );
}

/** Variant C: minimal — title + outlined ghost chips. */
function VariantC() {
  return (
    <div className="p-5">
      <header>
        <p className="text-sm text-slate-500">
          {new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(
            new Date(2026, 8, 22),
          )}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Olá, {VOLUNTEER.nome}
        </h1>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
            {VOLUNTEER.papel}
          </span>
          {VOLUNTEER.setores.map((sector) => (
            <span
              key={sector}
              className="rounded-full border border-sky-200 bg-sky-50/70 px-2.5 py-1 text-xs font-medium text-sky-700"
            >
              {sector}
            </span>
          ))}
        </div>
      </header>
      <CardsSample />
    </div>
  );
}

/** Variant D: full-bleed hero with the profile summary as numbers. */
function VariantD() {
  return (
    <div>
      <section className="rounded-b-[28px] bg-sky-700 px-5 pb-6 pt-6 text-white">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold ring-1 ring-white/30">
            MA
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-sky-100/80">
              Início
            </p>
            <h1 className="truncate text-lg font-semibold">{VOLUNTEER.nome}</h1>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Papel", value: VOLUNTEER.papel },
            { label: "Setores", value: String(VOLUNTEER.setores.length) },
            { label: "Atendimentos", value: "4" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-white/10 px-2 py-3 ring-1 ring-white/15"
            >
              <dd className="truncate text-sm font-semibold">{stat.value}</dd>
              <dt className="mt-0.5 text-[11px] text-sky-100/80">
                {stat.label}
              </dt>
            </div>
          ))}
        </dl>
      </section>
      <div className="px-5 pt-5">
        <p className="text-xs leading-relaxed text-slate-500">
          Setores: {VOLUNTEER.setores.join(" · ")}
        </p>
        <CardsSample />
      </div>
    </div>
  );
}

export default function HeaderPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 p-5 pb-16">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
        Prévia: cabeçalho do Início
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Quatro opções para o topo da tela principal, com dados fictícios.
        Página temporária — será removida depois da escolha.
      </p>

      <Frame
        label="Opção A — Barra de app fixa"
        summary="Cabeçalho estilo app nativo: avatar com as iniciais, nome em destaque e um botão de menu à direita. Papel e setores viram uma linha de texto simples (as cápsulas somem), com o detalhe acessível pelo menu."
      >
        <VariantA />
      </Frame>

      <Frame
        label="Opção B — Cartão de perfil"
        summary="Um cartão com gradiente azul abriga o perfil inteiro: avatar, nome e as cápsulas de papel e setores dentro dele. As informações continuam todas visíveis, mas agrupadas num bloco só, com cara de app."
      >
        <VariantB />
      </Frame>

      <Frame
        label="Opção C — Título + cápsulas suaves"
        summary="Mudança mais discreta: mantém a estrutura atual (saudação + cápsulas), mas troca os blocos cinza/azul cheios por cápsulas com borda e fundo leve, e acrescenta a data do dia. É a opção mais conservadora."
      >
        <VariantC />
      </Frame>

      <Frame
        label="Opção D — Hero com resumo"
        summary="Cabeçalho colorido de ponta a ponta com o nome e três números de resumo (papel, setores, atendimentos). O mais “dashboard”: a lista de setores vira texto pequeno abaixo."
      >
        <VariantD />
      </Frame>
    </main>
  );
}
