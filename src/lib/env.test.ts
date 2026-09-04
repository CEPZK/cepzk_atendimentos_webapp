import { afterEach, describe, expect, it, vi } from "vitest";
import { getWhatsAppGroupLink } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getWhatsAppGroupLink", () => {
  it("returns null when the variable is not set", () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_GROUP_LINK", "");
    expect(getWhatsAppGroupLink()).toBeNull();
  });

  it("returns the invite link when it is valid", () => {
    const link = "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv";
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_GROUP_LINK", link);
    expect(getWhatsAppGroupLink()).toBe(link);
  });

  it("trims whitespace around the value", () => {
    const link = "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv";
    vi.stubEnv(
      "NEXT_PUBLIC_WHATSAPP_GROUP_LINK",
      `  ${link}  `,
    );
    expect(getWhatsAppGroupLink()).toBe(link);
  });

  it("returns null and warns for invalid links", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_WHATSAPP_GROUP_LINK",
      "https://wa.me/5511999999999",
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getWhatsAppGroupLink()).toBeNull();
    expect(error).toHaveBeenCalledOnce();
  });
});
