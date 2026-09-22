import type { Metadata } from "next";
import {
  belongsToDepartment,
  belongsToSector,
  loadVolunteerSectors,
  requireVolunteer,
} from "@/lib/current-volunteer";
import { isAdmin, initials, ROLE_LABELS } from "@/lib/volunteer";
import {
  ACA_SECTOR,
  ATENDIMENTO_FRATERNO,
  DESOBSESSAO_INFANTIL_I_SECTOR,
  DESOBSESSAO_INFANTIL_II_SECTOR,
} from "@/lib/assistido";
import { FeatureCard } from "@/app/feature-card";
import { ProfileMenu } from "@/app/profile-menu";
import {
  BookHeartIcon,
  CalendarHeartIcon,
  ClipboardUserIcon,
  ListHeartIcon,
  UserListIcon,
  UserPlusIcon,
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
  const sectors = await loadVolunteerSectors(supabase, volunteer.id);

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
        "Consultar os assistidos e as assistências de cada um, e cadastrar novos.",
      icon: <ClipboardUserIcon />,
      // A lista geral é dos admins: os times enxergam seus assistidos
      // pelos cards próprios, e o Atendimento Fraterno, pelo cadastro.
      isVisible: isAdmin(volunteer),
    },
    {
      key: "atendimento-fraterno-cadastrar",
      href: "/atendimento-fraterno/cadastrar",
      title: "Cadastrar Assistido",
      description: "Cadastrar um novo assistido ou alterar um existente.",
      icon: <UserPlusIcon />,
      // Só o time do Atendimento Fraterno, que faz a entrevista; os
      // admins cadastram pela Lista de Assistidos.
      isVisible: belongsToDepartment(sectors, ATENDIMENTO_FRATERNO),
    },
    {
      key: "di-i",
      href: "/desobsessao-infantil-i",
      title: "Assistentes em Desobsessão Infantil I",
      description:
        "Consultar os assistidos com assistência ativa da Desobsessão Infantil I.",
      icon: <UserListIcon />,
      isVisible:
        belongsToSector(sectors, DESOBSESSAO_INFANTIL_I_SECTOR) ||
        // Compatibilidade com setor legado "Desobsessão Infantil" (sem sufixo).
        sectors.some(
          (s) =>
            s.nome === "Desobsessão Infantil" &&
            !belongsToSector(sectors, DESOBSESSAO_INFANTIL_II_SECTOR),
        ),
    },
    {
      key: "di-ii",
      href: "/desobsessao-infantil-ii",
      title: "Assistidos em Desobsessão Infantil",
      description: "Consultar os assistidos em desobsessão infantil.",
      icon: <UserListIcon />,
      isVisible: belongsToSector(sectors, DESOBSESSAO_INFANTIL_II_SECTOR),
    },
    {
      key: "aca-lista-espera",
      href: "/acolher-com-amor/lista-de-espera",
      title: "Lista de Espera para o Acolher com Amor",
      description:
        "Consultar os assistidos cuja próxima assistência é o Acolher com Amor.",
      icon: <ListHeartIcon />,
      // Só o próprio time do Acolher com Amor (mais o admin) acompanha
      // quem está esperando por ele.
      isVisible: isAdmin(volunteer) || belongsToSector(sectors, ACA_SECTOR),
    },
    {
      key: "aca-calendario",
      href: "/acolher-com-amor/calendario",
      title: "Calendário do Acolher com Amor",
      description:
        "Ver as sessões agendadas e ajustar as assistências de cada assistido.",
      icon: <CalendarHeartIcon />,
      // Mesmo público da lista de espera: o time do Acolher com Amor
      // (mais o admin).
      isVisible: isAdmin(volunteer) || belongsToSector(sectors, ACA_SECTOR),
    },
    {
      key: "aca-relatorios",
      href: "/acolher-com-amor/relatorios",
      title: "Relatório de Atendimentos",
      description:
        "Consultar os relatórios das sessões e registrar ponte, dirigente e observações.",
      icon: <BookHeartIcon />,
      // Só o time do Acolher com Amor (e o admin) registra e consulta os
      // relatórios das sessões do Acolher com Amor.
      isVisible: isAdmin(volunteer) || belongsToSector(sectors, ACA_SECTOR),
    },
  ].filter((card) => card.isVisible);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 py-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-semibold text-white"
          >
            {initials(volunteer)}
          </span>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-slate-900">
            {volunteer.nome}
          </h1>
          <ProfileMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <p className="text-sm text-slate-500">
          {sectors.length === 0 ? (
            ROLE_LABELS[volunteer.papel]
          ) : (
            // One "{role} · {sector}" pair per line: the schedule is what
            // releases features, so each sector is a pairing, not a count.
            sectors.map((sector) => (
              <span key={sector.id} className="block">
                {`${ROLE_LABELS[volunteer.papel]} · ${sector.nome}`}
              </span>
            ))
          )}
        </p>

        <section className="mt-6">
          {cards.length > 0 ? (
            <div className="grid gap-3">
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
    </>
  );
}
