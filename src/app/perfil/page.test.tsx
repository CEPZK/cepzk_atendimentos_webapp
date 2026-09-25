import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentVolunteer } from "@/lib/current-volunteer";

vi.mock("@/lib/current-volunteer", () => ({
  requireVolunteer: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
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

import ProfilePage from "./page";
import { requireVolunteer } from "@/lib/current-volunteer";

beforeEach(() => {
  vi.mocked(requireVolunteer).mockResolvedValue({
    supabase: {} as CurrentVolunteer["supabase"],
    volunteer: {
      id: "volunteer-1",
      nome: "Mariana",
      sobrenome: "Almeida",
      telefone: "11 99999-9999",
      email: "mariana@example.com",
      papel: "coordenador",
    },
  });
});

describe("personal data screen", () => {
  it("prefills the editable fields with the volunteer's data", async () => {
    const html = renderToString(await ProfilePage()).replaceAll(
      "<!-- -->",
      "",
    );

    expect(html).toContain("Dados pessoais");
    expect(html).toContain('id="nome"');
    expect(html).toContain('value="Mariana"');
    expect(html).toContain('value="Almeida"');
    expect(html).toContain('value="11 99999-9999"');
  });

  it("shows the e-mail as read-only", async () => {
    const html = renderToString(await ProfilePage()).replaceAll(
      "<!-- -->",
      "",
    );

    expect(html).toContain('value="mariana@example.com"');
    expect(html).toMatch(/<input[^>]*id="email"[^>]*readonly/i);
    expect(html).toContain("não pode ser alterado");
  });

  it("links back to the home screen", async () => {
    const html = renderToString(await ProfilePage()).replaceAll(
      "<!-- -->",
      "",
    );

    expect(html).toMatch(/href="\/"[^>]*>Voltar ao início<\/a>/);
  });
});
