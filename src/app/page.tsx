import type { Metadata } from "next";
import {
  belongsToSector,
  loadVolunteerAtendimentos,
  loadVolunteerSectors,
  requireVolunteer,
} from "@/lib/current-volunteer";
import { isAdmin, ROLE_LABELS } from "@/lib/volunteer";
import { ACA_SECTOR } from "@/lib/assistido";
import { FeatureCard } from "@/app/feature-card";
import {
  CalendarIcon,
  ClipboardUserIcon,
  ClockIcon,
  UsersIcon,
} from "@/app/icons";

// Depends on the request cookies (session): never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Início",
};

export default async function HomePage() {
  const { supabase, volunteer } = await requireVolunteer();

  // Sectors the volunteer is scheduled for: the cards are released per
  // department, so the home screen needs them to decide what to show.
  const [sectors, atendimentos] = await Promise.all([
    loadVolunteerSectors(supabase, volunteer.id),
    loadVolunteerAtendimentos(supabase, volunteer.id),
  ]);

  const cards = [
    {
      key: "voluntarios",
      href: "/voluntarios",
      title: "Gerenciar Voluntários",
      description:
        "Consultar e editar os dados dos voluntários e suas escalas.",
      icon: <UsersIcon />,
      isVisible: isAdmin(volunteer),
    },
    {
      key: "assistidos",
      href: "/assistidos",
      title: "Lista de Assistidos",
      description:
        "Consultar os assistidos e seus tratamentos, e cadastrar novos.",
      icon: <ClipboardUserIcon />,
      // O Atendimento Fraterno vê todos; os outros times veem os
      // assistidos dos atendimentos da sua escala.
      isVisible: isAdmin(volunteer) || atendimentos.length > 0,
    },
    {
      key: "aca-lista-espera",
      href: "/acolher-com-amor/lista-de-espera",
      title: "Lista de Espera para o Acolher com Amor",
      description:
        "Consultar os assistidos cujo próximo tratamento é o Acolher com Amor.",
      icon: <ClockIcon />,
      // Só o próprio time do Acolher com Amor (mais o admin) acompanha
      // quem está esperando por ele.
      isVisible: isAdmin(volunteer) || belongsToSector(sectors, ACA_SECTOR),
    },
    {
      key: "aca-calendario",
      href: "/acolher-com-amor/calendario",
      title: "Calendário do Acolher com Amor",
      description:
        "Ver as sessões agendadas e ajustar os tratamentos de cada assistido.",
      icon: <CalendarIcon />,
      // Mesmo público da lista de espera: o time do Acolher com Amor
      // (mais o admin).
      isVisible: isAdmin(volunteer) || belongsToSector(sectors, ACA_SECTOR),
    },
  ].filter((card) => card.isVisible);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <header>
        <p className="text-sm text-slate-500">CEPZK · Atendimentos</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Olá, {volunteer.nome}!
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {ROLE_LABELS[volunteer.papel]}
          </span>
          {sectors.map((sector) => (
            <span
              key={sector.id}
              className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700"
            >
              {sector.nome}
            </span>
          ))}
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-slate-500">
          O que você pode fazer
        </h2>

        {cards.length > 0 ? (
          <div className="mt-3 grid gap-3">
            {cards.map((card) => (
              <FeatureCard
                key={card.key}
                href={card.href}
                title={card.title}
                description={card.description}
                icon={card.icon}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm leading-relaxed text-slate-500">
            Nenhuma funcionalidade disponível para o seu perfil ainda. Assim
            que novas atividades forem liberadas para o seu setor, elas
            aparecerão aqui.
          </p>
        )}
      </section>
    </main>
  );
}
