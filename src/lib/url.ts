/**
 * Returns a safe same-origin path or "/" when the given value is not a
 * same-origin path. Guards against open redirects through the `next`
 * query parameter (e.g. "//evil.com" or "/\\evil.com").
 */
export function sanitizeNextPath(value: string | null | undefined): string {
  if (
    value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  ) {
    return value;
  }
  return "/";
}
