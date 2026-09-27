// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AcaMonthCalendar } from "./aca-month-calendar";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-27T20:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("shared scheduling calendar", () => {
  it("preserves date and navigation limits when no controlled navigation is provided", () => {
    const select = vi.fn();
    render(<AcaMonthCalendar
      days={[{ iso: "2026-10-03T12:30:00Z", assistidos: [] }]}
      onSelectDay={select}
    />);
    expect(screen.getByText("outubro de 2026")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Mês anterior" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Próximo mês" }).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "2" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "3 09:30" }));
    expect(select).toHaveBeenCalledWith("2026-10-03");
  });

  it("uses the month from newly loaded props rather than a stale local cursor", () => {
    const select = vi.fn();
    const changeMonth = vi.fn();
    const { rerender } = render(<AcaMonthCalendar
      month={{ year: 2026, month: 9 }}
      onMonthChange={changeMonth}
      days={[{ iso: "2026-09-26T12:30:00Z", assistidos: [] }]}
      onSelectDay={select}
    />);
    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(changeMonth).toHaveBeenCalledWith({ year: 2026, month: 8 });
    rerender(<AcaMonthCalendar
      month={{ year: 2026, month: 8 }}
      onMonthChange={changeMonth}
      days={[{ iso: "2026-08-29T12:30:00Z", assistidos: [] }]}
      onSelectDay={select}
    />);
    expect(screen.getByText("agosto de 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "29 09:30" }));
    expect(select).toHaveBeenCalledWith("2026-08-29");
  });
});
