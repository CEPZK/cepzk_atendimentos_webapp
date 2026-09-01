/**
 * Assistidos: the people who receive the treatments, and the treatments
 * themselves (`cepzk_assistido` / `cepzk_tratamento` and the Acolher com
 * Amor extensions).
 */

/** Sector whose treatments carry the Acolher com Amor extra data. */
export const ACA_SECTOR = "Acolher com Amor";

/** Distonia that asks for the list of main complaints. */
export const TEA_DISTONIA = "TEA";

/** Pre-selected distonia, as agreed with the Acolher com Amor team. */
export const DEFAULT_DISTONIA = "Outros";

/** Department that owns the assistidos list. */
export const ATENDIMENTO_FRATERNO = "Atendimento Fraterno";

export interface Assistido {
  id: number;
  nome_completo: string;
  data_criacao?: string;
}

/** A catalogue row (sectors, schedules, distonias, complaints). */
export interface CatalogItem {
  id: number;
  nome: string;
}

export interface SectorItem extends CatalogItem {
  departamento: string | null;
}

/** A treatment as shown on the (read-only) assistido screen. */
export interface TreatmentView {
  id: number;
  setor: string;
  departamento: string | null;
  horario: string;
  estado: string;
  obs: string | null;
  /** Acolher com Amor only. */
  distonia: string | null;
  queixas: string[];
}

/** A treatment as filled in on the registration screen. */
export interface TreatmentInput {
  setorId: number | null;
  horarioId: number | null;
  distoniaId: number | null;
  queixaIds: number[];
  obs: string;
}

export const TREATMENT_STATE_LABELS: Record<string, string> = {
  pendente: "Em tratamento",
  completo: "Alta",
};

export function treatmentStateLabel(estado: string): string {
  return TREATMENT_STATE_LABELS[estado] ?? estado;
}

// -----------------------------------------------------------------------------
// Name matching
//
// Registering someone twice is the mistake this screen exists to prevent,
// so the check has to catch names that were typed differently — "Luca
// Silva" must find "Lucas Silva" and "Silva".
// -----------------------------------------------------------------------------

/** Particles that carry no identity and would match everyone. */
const NAME_PARTICLES = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "di",
  "du",
  "del",
  "della",
  "la",
  "le",
  "van",
  "von",
  "y",
]);

/** Lowercase, without accents or punctuation. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token && !NAME_PARTICLES.has(token));
}

function bigrams(value: string): string[] {
  if (value.length < 2) return [value];
  const pairs: string[] = [];
  for (let i = 0; i < value.length - 1; i++) pairs.push(value.slice(i, i + 2));
  return pairs;
}

/** Sørensen–Dice coefficient over letter pairs: 0 (nothing) to 1 (equal). */
function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const left = bigrams(a);
  const right = new Map<string, number>();
  for (const pair of bigrams(b)) {
    right.set(pair, (right.get(pair) ?? 0) + 1);
  }

  let shared = 0;
  for (const pair of left) {
    const available = right.get(pair) ?? 0;
    if (available > 0) {
      shared++;
      right.set(pair, available - 1);
    }
  }

  return (2 * shared) / (left.length + bigrams(b).length);
}

function bestMatch(token: string, others: string[]): number {
  return others.reduce((best, other) => Math.max(best, dice(token, other)), 0);
}

/**
 * How much two names look alike, from 0 to 1.
 *
 * Compares name by name (so word order and missing names do not matter)
 * and the whole string (so a single long name still counts).
 */
export function nameSimilarity(query: string, candidate: string): number {
  const queryTokens = nameTokens(query);
  const candidateTokens = nameTokens(candidate);
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;

  const fromQuery =
    queryTokens.reduce(
      (sum, token) => sum + bestMatch(token, candidateTokens),
      0,
    ) / queryTokens.length;

  const fromCandidate =
    candidateTokens.reduce(
      (sum, token) => sum + bestMatch(token, queryTokens),
      0,
    ) / candidateTokens.length;

  const whole = dice(
    queryTokens.join(""),
    candidateTokens.join(""),
  );

  return 0.45 * fromQuery + 0.25 * fromCandidate + 0.3 * whole;
}

/** Below this the names have nothing meaningful in common. */
export const SIMILARITY_THRESHOLD = 0.35;

export interface SimilarAssistido extends Assistido {
  score: number;
}

/** The registered names that look like `query`, best match first. */
export function findSimilarNames(
  query: string,
  candidates: Assistido[],
  limit = 8,
): SimilarAssistido[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: nameSimilarity(query, candidate.nome_completo),
    }))
    .filter((candidate) => candidate.score >= SIMILARITY_THRESHOLD)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
    )
    .slice(0, limit);
}

/** Initials used by the avatar bubbles. */
export function assistidoInitials(nomeCompleto: string): string {
  const parts = nameTokens(nomeCompleto);
  const letters = [parts[0], parts.length > 1 ? parts[parts.length - 1] : ""]
    .map((part) => part?.[0])
    .filter(Boolean)
    .join("");
  return (letters || "?").toUpperCase();
}
