import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CadastroAssistidoForm } from "./cadastro-assistido-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/app/assistidos/actions", () => ({
  createAssistido: vi.fn(),
}));

vi.mock("./actions", () => ({
  saveAssistido: vi.fn(),
  updateTreatment: vi.fn(),
  removeTreatment: vi.fn(),
}));

const atendimentos = [
  {
    id: 1,
    setorId: 10,
    setor: "Acolher com Amor",
    departamento: "Assistência Social",
    horario: "Segundas · 15h",
    precedencia: 1,
  },
  {
    id: 2,
    setorId: 20,
    setor: "Desobsessão Infantil",
    departamento: "Mediúnica",
    horario: "Terças · 9h",
    precedencia: 2,
  },
  {
    id: 3,
    setorId: 20,
    setor: "Desobsessão Infantil",
    departamento: "Mediúnica",
    horario: "Quintas · 9h",
    precedencia: 2,
  },
];

const existingTreatments = [
  {
    id: 11,
    atendimentoId: 1,
    setor: "Acolher com Amor",
    horario: "Segundas · 15h",
    precedencia: 1,
    estado: "em tratamento",
    archived: false,
    obs: null,
    distonia: "TEA",
    distoniaId: 4,
    queixas: ["Agressividade", "Insônia"],
    queixaIds: [7, 8],
  },
  {
    id: 12,
    atendimentoId: 2,
    setor: "Desobsessão Infantil",
    horario: "Terças · 9h",
    precedencia: 2,
    estado: "alta",
    archived: false,
    obs: "Concluído com sucesso",
    distonia: null,
    distoniaId: null,
    queixas: [],
    queixaIds: [],
  },
];

const assistido = { id: 100, nomeCompleto: "João", archived: false };

describe("CadastroAssistidoForm", () => {
  it("lists the Acolher com Amor queixas as a bulleted list", () => {
    const html = renderToString(
      <CadastroAssistidoForm
        assistido={assistido}
        atendimentos={atendimentos}
        distonias={[
          { id: 4, nome: "TEA" },
          { id: 5, nome: "Outros" },
        ]}
        queixas={[
          { id: 7, nome: "Agressividade" },
          { id: 8, nome: "Insônia" },
        ]}
        existingTreatments={existingTreatments}
      />,
    );

    expect(html).toContain("Agressividade");
    expect(html).toContain("Insônia");
    // Queixas are a plain bulleted list, not pills.
    expect(html).toContain("list-disc");
    expect(html).not.toContain("rounded-full bg-sky-50");
  });

  it("offers only sectors without an open treatment, whatever the horário", () => {
    const html = renderToString(
      <CadastroAssistidoForm
        assistido={assistido}
        atendimentos={atendimentos}
        distonias={[{ id: 5, nome: "Outros" }]}
        queixas={[]}
        existingTreatments={existingTreatments}
      />,
    );

    // Acolher com Amor has a treatment in progress: no horário of the
    // sector may be offered again.
    expect(html).not.toContain("Acolher com Amor — Segundas · 15h");
    // Desobsessão Infantil is concluded (alta): both horários return
    // to the options.
    expect(html).toContain("Desobsessão Infantil — Terças · 9h");
    expect(html).toContain("Desobsessão Infantil — Quintas · 9h");
    expect(html).toContain(
      "Setores com assistência em andamento não aparecem nas opções",
    );
  });

  it("lets open treatments be edited and removed, but not concluded ones", () => {
    const html = renderToString(
      <CadastroAssistidoForm
        assistido={assistido}
        atendimentos={atendimentos}
        distonias={[{ id: 4, nome: "TEA" }]}
        queixas={[
          { id: 7, nome: "Agressividade" },
          { id: 8, nome: "Insônia" },
        ]}
        existingTreatments={existingTreatments}
      />,
    );

    // Only the open treatment gets an editor: exactly one "Editar" (the
    // alta card is read-only) and two "Remover" buttons — the editor's and
    // the one of the new-assistance block.
    expect(html.match(/>Editar</g) ?? []).toHaveLength(1);
    expect(html.match(/>Remover</g) ?? []).toHaveLength(2);
    expect(html).toContain(
      "Assistências em andamento podem ser editadas ou removidas por aqui",
    );
  });

  it("hides new treatments when every sector is open already", () => {
    const html = renderToString(
      <CadastroAssistidoForm
        assistido={assistido}
        atendimentos={atendimentos.slice(0, 1)}
        distonias={[{ id: 4, nome: "TEA" }]}
        queixas={[]}
        existingTreatments={[existingTreatments[0]]}
      />,
    );

    expect(html).toContain("não há novas assistências para incluir agora");
    expect(html).not.toContain("Adicionar assistência");
  });
});
