import { describe, expect, it } from "vitest";
import {
  formatCooldown,
  isOtpComplete,
  normalizeOtpCode,
  OTP_LENGTH,
  OTP_MAX_DIGITS,
} from "./otp";

describe("normalizeOtpCode", () => {
  it("keeps plain digits untouched", () => {
    expect(normalizeOtpCode("123456")).toBe("123456");
  });

  it("strips spaces, dashes and line breaks pasted from the e-mail", () => {
    expect(normalizeOtpCode(" 123-456\n")).toBe("123456");
  });

  it("drops letters", () => {
    expect(normalizeOtpCode("ab12cd34")).toBe("1234");
  });

  it("caps the length instead of rejecting longer codes", () => {
    expect(normalizeOtpCode("123456789012")).toHaveLength(OTP_MAX_DIGITS);
  });
});

describe("isOtpComplete", () => {
  it("is false below the expected length", () => {
    expect(isOtpComplete("12345")).toBe(false);
  });

  it("is true at the expected length", () => {
    expect(isOtpComplete("1".repeat(OTP_LENGTH))).toBe(true);
  });

  it("stays true past the expected length (the server decides)", () => {
    expect(isOtpComplete("1".repeat(OTP_LENGTH + 2))).toBe(true);
  });
});

describe("formatCooldown", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatCooldown(60)).toBe("1:00");
    expect(formatCooldown(7)).toBe("0:07");
    expect(formatCooldown(0)).toBe("0:00");
  });

  it("clamps negative values", () => {
    expect(formatCooldown(-5)).toBe("0:00");
  });
});
