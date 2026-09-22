import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CurrentVolunteer,
  VolunteerSector,
} from "@/lib/current-volunteer";

vi.mock("@/lib/current-volunteer", () => ({
  requireVolunteer: vi.fn(),
  loadVolunteerSectors: vi.fn(),
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

import DesobsessaoInfantilPage from "./page";
import {
  loadVolunteerSectors,
  requireVolunteer,
} from "@/lib/current-volunteer";

/** The page only chains `from().select().returns()` over treatments. */
const supabaseStub = {
  from: () => ({
    select: () => ({
      returns: async () => ({ data: [], error: null }),
    }),
  }),
};

beforeEach(() => {
  vi.mocked(requireVolunteer).mockResolvedValue({
    supabase: supabaseStub as unknown as CurrentVolunteer["supabase"],
    volunteer: {
      id: "volunteer-1",
      nome: "Mariana",
      sobrenome: "Almeida",
      telefone: "11 99999-9999",
      email: "mariana@example.com",
      papel: "coordenador",
    },
  });
  vi.mocked(loadVolunteerSectors).mockResolvedValue([
    { id: 2, nome: "Desobsessão Infantil", departamento: "Infância" },
  ] as VolunteerSector[]);
});

describe("Desobsessão Infantil list screen", () => {
  it("shows the new title and no subtitle", async () => {
    const html = renderToString(await DesobsessaoInfantilPage()).replaceAll(
      "<!-- -->",
      "",
    );

    expect(html).toContain(">Assistidos em Desobsessão Infantil</h1>");
    expect(html).not.toContain("Desobsessão Infantil II");
    expect(html).not.toContain("ordenados alfabeticamente");
  });
});
