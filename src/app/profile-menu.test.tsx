// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileMenu } from "./profile-menu";
import {
  setDeferredPromptForTesting,
  type BeforeInstallPromptEvent,
} from "./use-pwa-install";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    className,
    role,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    role?: string;
  }) => (
    <a href={href} onClick={onClick} className={className} role={role}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/session-actions", () => ({
  signOut: vi.fn(),
}));

describe("ProfileMenu", () => {
  const originalUserAgent = window.navigator.userAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    setDeferredPromptForTesting(null);
  });

  afterEach(() => {
    cleanup();
    setDeferredPromptForTesting(null);
    Object.defineProperty(window.navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
    delete (window.navigator as unknown as { standalone?: boolean }).standalone;
  });

  it("renders the toggle button and opens menu on click", () => {
    render(<ProfileMenu />);

    const button = screen.getByRole("button", { name: "Abrir menu" });
    expect(button).toBeDefined();
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(button);

    expect(screen.getByRole("menu")).toBeDefined();
  });

  it("renders 'Instalar Aplicativo' before 'Sair' in the menu", () => {
    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    const menu = screen.getByRole("menu");
    const menuItems = menu.querySelectorAll('[role="menuitem"]');

    expect(menuItems).toHaveLength(3);
    expect(menuItems[0].textContent).toBe("Dados pessoais");
    expect(menuItems[1].textContent).toBe("Instalar Aplicativo");
    expect(menuItems[2].textContent).toBe("Sair");
  });

  it("hides 'Instalar Aplicativo' when running in standalone mode", () => {
    Object.defineProperty(window.navigator, "standalone", {
      value: true,
      configurable: true,
    });

    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));

    const menu = screen.getByRole("menu");
    const menuItems = menu.querySelectorAll('[role="menuitem"]');

    expect(menuItems).toHaveLength(2);
    expect(menuItems[0].textContent).toBe("Dados pessoais");
    expect(menuItems[1].textContent).toBe("Sair");
    expect(screen.queryByRole("menuitem", { name: "Instalar Aplicativo" })).toBeNull();
  });

  it("opens the installation guide dialog when clicking 'Instalar Aplicativo' and native prompt is unavailable", async () => {
    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Instalar Aplicativo" }));

    // Menu closes and dialog opens
    expect(screen.queryByRole("menu")).toBeNull();
    const dialog = await screen.findByRole("dialog", { name: "Instalar Aplicativo" });
    expect(dialog).toBeDefined();

    // Dismiss dialog with "Entendido"
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows Safari-specific instructions when on iOS device with Safari", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      configurable: true,
    });

    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Instalar Aplicativo" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Instalar no iPhone / iPad",
    });
    expect(dialog).toBeDefined();
    expect(screen.getByText(/Safari/)).toBeDefined();
    expect(screen.getByText(/Compartilhar/)).toBeDefined();
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeDefined();
  });

  it("shows Chrome-specific instructions when on iOS device with Chrome (CriOS)", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
      configurable: true,
    });

    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Instalar Aplicativo" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Instalar no Chrome (iOS)",
    });
    expect(dialog).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Instalar no Chrome (iOS)" }),
    ).toBeDefined();
    expect(screen.getAllByText(/Chrome/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Compartilhar/)).toBeDefined();
    expect(screen.getByText(/Adicionar à Tela de Início/)).toBeDefined();
  });

  it("calls prompt() when native prompt is available", async () => {
    const promptMock = vi.fn().mockResolvedValue(undefined);
    const fakePromptEvent = {
      preventDefault: vi.fn(),
      prompt: promptMock,
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      platforms: ["web"],
    } as unknown as BeforeInstallPromptEvent;

    setDeferredPromptForTesting(fakePromptEvent);

    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Instalar Aplicativo" }));

    expect(promptMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      // Since it was accepted, guide dialog is not opened
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("dismisses the guide dialog on Escape key", async () => {
    render(<ProfileMenu />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Instalar Aplicativo" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeDefined();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
