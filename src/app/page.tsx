import type { Metadata } from "next";
import { requireVolunteer } from "@/lib/current-volunteer";
import { isAdmin, ROLE_LABELS } from "@/lib/volunteer";
import { FeatureCard } from "@/app/feature-card";
import { UsersIcon } from "@/app/icons";

// Depends on the request cookies (session): never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Início",
};

export default async function HomePage() {
  const { supabase, volunteer } = await requireVolunteer();

  // Sectors the volunteer is scheduled for — the upcoming cards are
  // released per sector, so the home screen already knows them.
  const { data: schedule } = await supabase
    .from("cepzk_escala")
    .select("setor:cepzk_setor (id, nome)")
    .eq("voluntario_id", volunteer.id);

  const sectors = (schedule ?? [])
    .flatMap((row) => (Array.isArray(row.setor) ? row.setor : [row.setor]))
    .filter((sector): sector is { id: number; nome: string } => Boolean(sector));

  const uniqueSectors = [
    ...new Map(sectors.map((sector) => [sector.id, sector])).values(),
  ];

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
          {uniqueSectors.map((sector) => (
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
