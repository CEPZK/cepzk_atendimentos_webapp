import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  // The form rendered inside the page is a client component.
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import CompleteProfilePage from "./page";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const EMAIL = "mariana.silva@example.com";

function stubSupabase(volunteer: {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  telefone: string | null;
}) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: volunteer.id, email: EMAIL, user_metadata: {} } },
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: volunteer }) })),
      })),
    })),
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("complete profile screen", () => {
  it.each(["mariana.silva", EMAIL])(
    "does not prefill the name with the placeholder %s",
    async (nome) => {
      // The database trigger fills `nome` with the part of the e-mail before
      // the "@" while the invite carries no name.
      stubSupabase({
        id: "volunteer-1",
        nome,
        sobrenome: null,
        telefone: null,
      });

      const html = renderToString(await CompleteProfilePage()).replaceAll(
        "<!-- -->",
        "",
      );

      expect(html).toContain("Complete seu cadastro");
      expect(html).not.toContain("mariana.silva");
      expect(html).toMatch(/<input[^>]*id="nome"[^>]*value=""/i);
      expect(html).toMatch(/<input[^>]*id="sobrenome"[^>]*value=""/i);
      expect(html).toMatch(/<input[^>]*id="telefone"[^>]*value=""/i);
    },
  );

  it("starts all fields blank even when the incomplete profile has saved data", async () => {
    stubSupabase({
      id: "volunteer-1",
      nome: "Mariana",
      sobrenome: "Almeida",
      telefone: null,
    });

    const html = renderToString(await CompleteProfilePage());
    for (const field of ["nome", "sobrenome", "telefone"]) {
      expect(html).toMatch(new RegExp(`<input[^>]*id="${field}"[^>]*value=""`));
    }
  });

  it.each(["Mariana", "mariana.silva"])(
    "still sends volunteers with a complete profile to the home screen (%s)",
    async (nome) => {
      stubSupabase({
        id: "volunteer-1",
        nome,
        sobrenome: "Almeida",
        telefone: "11 99999-9999",
      });

      await expect(CompleteProfilePage()).rejects.toThrow("redirect:/");
      expect(vi.mocked(redirect)).toHaveBeenCalledWith("/");
    },
  );

  it("sends unauthenticated visitors to the login", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    await expect(CompleteProfilePage()).rejects.toThrow("redirect:/login");
  });
});
