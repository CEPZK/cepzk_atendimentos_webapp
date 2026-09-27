// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CadastroAssistidoForm } from "./cadastro-assistido-form";
import { NewAssistidoFlow } from "@/app/assistidos/novo/new-assistido-flow";
import { createAssistido, findSimilarAssistidos } from "@/app/assistidos/actions";
import { saveAssistido } from "./actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    <a href={href}>{children}</a>,
}));
vi.mock("@/app/assistidos/actions", () => ({
  createAssistido: vi.fn(),
  findSimilarAssistidos: vi.fn(),
}));
vi.mock("./actions", () => ({
  saveAssistido: vi.fn(),
  updateTreatment: vi.fn(),
  removeTreatment: vi.fn(),
}));

const atendimentos = [
  { id: 1, setorId: 10, setor: "Acolher com Amor", departamento: null, horario: "Segunda", precedencia: 1 },
  { id: 2, setorId: 20, setor: "Desobsessão Infantil", departamento: null, horario: "Terça", precedencia: 2 },
  { id: 3, setorId: 20, setor: "Desobsessão Infantil", departamento: null, horario: "Quinta", precedencia: 2 },
];
const catalogs = { atendimentos, distonias: [{ id: 5, nome: "Outros" }], queixas: [] };
const assistido = { id: 100, nomeCompleto: "João Silva", archived: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAssistido).mockResolvedValue({ ok: true, id: 100 });
  vi.mocked(saveAssistido).mockResolvedValue({ ok: true, id: 100 });
  vi.mocked(findSimilarAssistidos).mockResolvedValue({ ok: true, matches: [] });
});
afterEach(cleanup);

async function openForm(mode: "new" | "existing" | "admin") {
  if (mode === "admin") {
    render(<NewAssistidoFlow {...catalogs} />);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "João Silva" } });
    fireEvent.submit(screen.getByLabelText("Nome completo").closest("form")!);
    await screen.findByLabelText("Atendimento");
  } else {
    render(
      <CadastroAssistidoForm
        {...catalogs}
        assistido={mode === "existing" ? assistido : null}
        initialName="João Silva"
        existingTreatments={[]}
      />,
    );
  }
}

function selects() {
  return screen.getAllByLabelText<HTMLSelectElement>("Atendimento");
}
function choose(index: number, value: string) {
  fireEvent.change(selects()[index], { target: { value } });
}
function addButton() {
  return screen.getByRole<HTMLButtonElement>("button", { name: "Adicionar assistência" });
}
function submit() {
  fireEvent.submit(screen.getByLabelText("Nome completo").closest("form")!);
}

describe.each(["new", "existing", "admin"] as const)("treatment selection (%s)", (mode) => {
  it("blocks saving and adding when the first selection is blank", async () => {
    await openForm(mode);
    expect(addButton().disabled).toBe(true);
    fireEvent.click(addButton());
    expect(selects()).toHaveLength(1);

    submit();
    expect(screen.getByRole("alert").textContent).toContain("Escolha o atendimento de cada assistência.");
    expect(createAssistido).not.toHaveBeenCalled();
    expect(saveAssistido).not.toHaveBeenCalled();
  });

  it("requires every added row to be selected and submits all valid rows", async () => {
    await openForm(mode);
    choose(0, "1");
    expect(addButton().disabled).toBe(false);
    fireEvent.click(addButton());
    expect(selects()).toHaveLength(2);
    expect(addButton().disabled).toBe(true);

    submit();
    expect(createAssistido).not.toHaveBeenCalled();
    expect(saveAssistido).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Escolha o atendimento");

    choose(1, "2");
    submit();
    const action = mode === "existing" ? saveAssistido : createAssistido;
    await waitFor(() => expect(action).toHaveBeenCalledWith(expect.objectContaining({
      treatments: [
        { atendimentoId: 1, distoniaId: 5, queixaIds: [], obs: "" },
        { atendimentoId: 2, distoniaId: null, queixaIds: [], obs: "" },
      ],
    })));
  });

  it("excludes duplicates in both directions and restores removed selections", async () => {
    await openForm(mode);
    choose(0, "2");
    fireEvent.click(addButton());
    expect(Array.from(selects()[1].options).map((o) => o.value)).toEqual(["", "1", "3"]);
    choose(1, "1");
    expect(Array.from(selects()[0].options).map((o) => o.value)).toEqual(["", "2", "3"]);

    // Changing a selection releases the previous option in the other row.
    choose(0, "3");
    expect(Array.from(selects()[1].options).map((o) => o.value)).toEqual(["", "1", "2"]);

    fireEvent.click(within(selects()[0].closest("li")!).getByRole("button", { name: "Remover" }));
    expect(selects()).toHaveLength(1);
    expect(selects()[0].value).toBe("1");
    expect(Array.from(selects()[0].options).map((o) => o.value)).toEqual(["", "1", "2", "3"]);
  });

  it("blocks adding again if an earlier selection is cleared", async () => {
    await openForm(mode);
    choose(0, "2");
    fireEvent.click(addButton());
    choose(1, "3");
    choose(0, "");
    expect(addButton().disabled).toBe(true);
    submit();
    expect(createAssistido).not.toHaveBeenCalled();
    expect(saveAssistido).not.toHaveBeenCalled();
  });

  it("stops offering new rows when all options are selected", async () => {
    await openForm(mode);
    for (const [index, id] of ["1", "2", "3"].entries()) {
      if (index > 0) fireEvent.click(addButton());
      choose(index, id);
    }
    expect(screen.queryByRole("button", { name: "Adicionar assistência" })).toBeNull();
  });
});

it("lets an existing assistido save only their name after removing the unused row", async () => {
  await openForm("existing");
  fireEvent.click(screen.getByRole("button", { name: "Remover" }));
  expect(addButton().disabled).toBe(false);
  submit();
  await waitFor(() => expect(saveAssistido).toHaveBeenCalledWith({
    assistidoId: 100, nomeCompleto: "João Silva", treatments: [],
  }));
});

it("does not leave an invisible required draft when all sectors are blocked", async () => {
  render(
    <CadastroAssistidoForm
      {...catalogs}
      atendimentos={atendimentos.slice(0, 1)}
      assistido={assistido}
      existingTreatments={[{
        id: 10, atendimentoId: 1, setor: "Acolher com Amor", horario: "Segunda",
        precedencia: 1, estado: "em tratamento", archived: false,
        obs: null, distonia: "Outros", distoniaId: 5, queixas: [], queixaIds: [],
      }]}
    />,
  );
  expect(screen.queryByLabelText("Atendimento")).toBeNull();
  submit();
  await waitFor(() => expect(saveAssistido).toHaveBeenCalledWith({
    assistidoId: 100, nomeCompleto: "João Silva", treatments: [],
  }));
});
