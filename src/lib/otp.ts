/**
 * How many digits the Supabase project is configured to send
 * (Dashboard → Authentication → Email → OTP Settings → OTP Length).
 *
 * Used only for UX (field hints, auto-submit): `verifyOtp` on the server
 * is the authority on the exact length, so a mismatch here degrades to
 * the manual "Entrar" button instead of breaking the login.
 */
export const OTP_LENGTH = 6;

/**
 * Hard cap for the code field. Deliberately looser than the issuer so a
 * future length change never bricks the form.
 */
export const OTP_MAX_DIGITS = 10;

/** Seconds before another code can be requested. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/**
 * Keeps only digits — strips spaces, dashes and line breaks pasted from
 * the e-mail — and caps the length at `OTP_MAX_DIGITS`.
 */
export function normalizeOtpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, OTP_MAX_DIGITS);
}

/** Whether the code is worth sending to Supabase for verification. */
export function isOtpComplete(code: string): boolean {
  return code.length >= OTP_LENGTH;
}

/** Formats a resend countdown as `M:SS` (`"1:00"`, `"0:07"`). */
export function formatCooldown(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(clamped / 60)}:${String(clamped % 60).padStart(2, "0")}`;
}
