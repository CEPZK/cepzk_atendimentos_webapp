// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NovoRelatorioPage from "./page";
import { requireSector } from "@/lib/current-volunteer";
import { registerAcaRelatorios } from "./actions";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/current-volunteer", () => ({ requireSector: vi.fn() }));
vi.mock("./actions", () => ({ registerAcaRelatorios: vi.fn() }));

const atendimento = {
  id: 1, precedencia: 1,
  setor: { id: 10, nome: "Acolher com Amor", departamento: null },
  horario: { nome: "Sábado 9h30" },
};
const session = {
  id: 123,
  data: "2025-01-18T12:30:00Z",
  relatorio: null,
  tratamento: {
    id: 20, atendimento_id: 1,
    assistido: { id: 30, nome_completo: "Maria Silva" },
  },
};

function stubDatabase(rows = [session], error: { message: string } | null = null) {
  const sessions = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data: rows, error }),
  };
  const from = vi.fn((table: string) => {
    if (table === "aca_sessao") return sessions;
    const data = table === "cepzk_atendimento" ? [atendimento] : [
      { voluntario: { id: "v1", nome: "Ana", sobrenome: null }, atendimento },
      { voluntario: { id: "v2", nome: "José", sobrenome: null }, atendimento },
    ];
    return { select: () => ({ returns: async () => ({ data }) }) };
  });
  vi.mocked(requireSector).mockResolvedValue({ supabase: { from } } as unknown as Awaited<ReturnType<typeof requireSector>>);
  return sessions;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-27T20:00:00Z"));
  stubDatabase();
  vi.mocked(registerAcaRelatorios).mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function openMonth(mes?: string | string[]) {
  return render(await NovoRelatorioPage({ searchParams: Promise.resolve({ mes }) }));
}

describe("report calendar dates", () => {
  it("loads a historical scheduled day and submits its actual session", async () => {
    const query = stubDatabase();
    await openMonth("2025-01");
    expect(requireSector).toHaveBeenCalledWith("Acolher com Amor");
    expect(query.gte).toHaveBeenCalledWith("data", "2024-12-29T03:00:00.000Z");
    expect(query.lt).toHaveBeenCalledWith("data", "2025-02-09T03:00:00.000Z");
    expect(screen.getByText("janeiro de 2025")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "18 09:30 Maria Silva" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("18/01/2025 · 09:30")).toBeTruthy();
    fireEvent.change(dialog.getByLabelText(/Dirigente/), { target: { value: "v1" } });
    fireEvent.change(dialog.getByLabelText(/Ponte/), { target: { value: "v2" } });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar relatórios" }));
    await waitFor(() => expect(registerAcaRelatorios).toHaveBeenCalledWith([{
      sessaoId: 123, tratamentoId: 20, dirigenteId: "v1", ponteId: "v2", obs: "",
    }]));
  });


  it("matches the ACA calendar's columns, times and selectable weekdays", async () => {
    const { container } = await openMonth("2025-01");
    // Only Saturdays are widened. Other weekdays stay muted and unclickable.
    const grid = container.querySelector<HTMLElement>(".grid[style]")!;
    expect(grid.style.gridTemplateColumns).toBe(
      "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,4fr)",
    );
    expect(screen.queryByRole("button", { name: /^14(?: |$)/ })).toBeNull();
    expect(screen.getByRole("button", { name: "18 09:30 Maria Silva" })).toBeTruthy();
    // Empty service days keep their scheduled time, including adjacent months.
    expect(screen.getByRole("button", { name: "1 09:30" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(8); // Six Saturdays + month navigation.
  });

  it("allows navigating before and after the loaded month, including year boundaries", async () => {
    await openMonth("2025-01");
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(push).toHaveBeenCalledWith("/acolher-com-amor/relatorios/novo?mes=2024-12", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(push).toHaveBeenCalledWith("/acolher-com-amor/relatorios/novo?mes=2025-02", { scroll: false });
  });

  it("allows choosing a day without sessions and explains why there is nothing to report", async () => {
    await openMonth("2025-01");
    fireEvent.click(screen.getByRole("button", { name: "11 09:30" }));
    expect(screen.getByText("Nenhum assistido agendado neste dia.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salvar relatórios" })).toBeNull();
    expect(registerAcaRelatorios).not.toHaveBeenCalled();
  });

  it("loads today's sessions even when their time has passed", async () => {
    vi.setSystemTime(new Date("2026-09-26T20:00:00Z"));
    const query = stubDatabase([{ ...session, data: "2026-09-26T12:30:00Z" }]);
    await openMonth();
    expect(query.gte).toHaveBeenCalledWith("data", "2026-08-30T03:00:00.000Z");
    fireEvent.click(screen.getByRole("button", { name: "26 09:30 Maria Silva" }));
    expect(screen.getByText("26/09/2026 · 09:30")).toBeTruthy();
  });

  it("also permits future months without the old six-month limit", async () => {
    const query = stubDatabase([]);
    await openMonth("2030-01");
    expect(screen.getByText("janeiro de 2030")).toBeTruthy();
    expect(query.gte).toHaveBeenCalledWith("data", "2029-12-30T03:00:00.000Z");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Próximo mês" }).disabled).toBe(false);
  });

  it.each(["invalid", "2025-13", "2025-00", ["2025-01", "2025-02"]])(
    "falls back to this month for malformed URLs (%s)", async (value) => {
      await openMonth(value);
      expect(screen.getByText("setembro de 2026")).toBeTruthy();
    },
  );

  it("does not misrepresent a failed query as a day without sessions", async () => {
    stubDatabase([], { message: "unavailable" });
    await openMonth("2025-01");
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível carregar as sessões");
    expect(screen.queryByText("Escolha o dia da sessão")).toBeNull();
  });
});
