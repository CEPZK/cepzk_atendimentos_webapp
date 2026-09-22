import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CurrentVolunteer,
  VolunteerSector,
} from "@/lib/current-volunteer";

// The home screen only composes presentation; the data gates live in
// `current-volunteer` and are stubbed here.
vi.mock("@/lib/current-volunteer", () => ({
  requireVolunteer: vi.fn(),
  loadVolunteerSectors: vi.fn(),
  belongsToDepartment: vi.fn(() => false),
  belongsToSector: vi.fn(() => false),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children?: React.ReactNode;
  }) => React.createElement("a", { href, className }, children),
}));

import HomePage from "./page";
import {
  loadVolunteerSectors,
  requireVolunteer,
} from "@/lib/current-volunteer";

function volunteerSession(papel: "admin" | "coordenador"): CurrentVolunteer {
  return {
    supabase: {} as CurrentVolunteer["supabase"],
    volunteer: {
      id: "volunteer-1",
      nome: "Mariana",
      sobrenome: "Almeida",
      telefone: "11 99999-9999",
      email: "mariana@example.com",
      papel,
    },
  };
}

const SECTORS: VolunteerSector[] = [
  { id: 1, nome: "Acolher com Amor", departamento: "Assistência" },
  { id: 2, nome: "Desobsessão Infantil I", departamento: "Mediunidade" },
];

/** Renders the home page and drops the SSR text-node separators. */
async function renderHome(): Promise<string> {
  return renderToString(await HomePage()).replaceAll("<!-- -->", "");
}

beforeEach(() => {
  vi.mocked(requireVolunteer).mockResolvedValue(volunteerSession("coordenador"));
  vi.mocked(loadVolunteerSectors).mockResolvedValue(SECTORS);
});

describe("home header", () => {
  it("shows the app bar with the volunteer's initials and name, without a greeting", async () => {
    const html = await renderHome();

    expect(html).toContain(">Mariana<");
    expect(html).toContain(">MA<");
    expect(html).not.toContain("Olá,");
    expect(html).not.toContain("CEPZK · Atendimentos</p>");
  });

  it("summarizes role and sectors in a single line instead of capsules", async () => {
    const html = await renderHome();

    expect(html).toContain("Coordenador · 2 setores");
    // Sector names no longer appear as individual capsules.
    expect(html).not.toContain("Desobsessão Infantil I</span>");
  });

  it("uses the singular when there is a single sector", async () => {
    vi.mocked(loadVolunteerSectors).mockResolvedValue(SECTORS.slice(0, 1));

    expect(await renderHome()).toContain("Coordenador · 1 setor");
  });

  it("omits the sector count when the volunteer has no sectors", async () => {
    vi.mocked(loadVolunteerSectors).mockResolvedValue([]);

    const html = await renderHome();

    expect(html).toContain(">Coordenador<");
    expect(html).not.toContain("Coordenador ·");
  });

  it("no longer prints the features section heading", async () => {
    expect(await renderHome()).not.toContain("O que você pode fazer");
  });
});

describe("home feature cards", () => {
  it("keeps the empty state for volunteers without released features", async () => {
    const html = await renderHome();

    expect(html).toContain("Nenhuma funcionalidade disponível");
  });

  it("releases the admin cards for admins", async () => {
    vi.mocked(requireVolunteer).mockResolvedValue(volunteerSession("admin"));

    const html = await renderHome();

    expect(html).toContain("Gerenciar Voluntários");
    expect(html).toContain("Lista de Assistidos");
  });
});
