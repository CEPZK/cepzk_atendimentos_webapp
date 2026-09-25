/**
 * `?from=` key used so the assistido detail screen knows where to route
 * the "Voltar" link back to. Living in its own module (not inside the
 * page.tsx) because Next.js does not allow arbitrary named exports from
 * a page file.
 */
export const DI_FROM = "di";
