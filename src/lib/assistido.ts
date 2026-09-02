/**
 * Assistidos: the people who receive the treatments, and the treatments
 * themselves (`cepzk_assistido` / `cepzk_tratamento` and the Acolher com
 * Amor extensions).
 */

/** Sector whose treatments carry the Acolher com Amor extra data. */
export const ACA_SECTOR = "Acolher com Amor";

/**
 * Sectors of the Desobsessão Infantil (I and II): the treatment ends with
 * an "alta" given by the team itself.
 */
export const DESOBSESSAO_INFANTIL_SECTOR = "Desobsessão Infantil";

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

/**
 * A row of the assistidos list: the name plus the state that decides
 * where it sits in the list (the most pending of their treatments).
 */
export interface AssistidoListItem extends Assistido {
  estado: string | null;
}

/** A catalogue row (sectors, schedules, distonias, complaints). */
export interface CatalogItem {
  id: number;
  nome: string;
}

/** A treatment as shown on the (read-only) assistido screen. */
export interface TreatmentView {
  id: number;
  setor: string;
  departamento: string | null;
  horario: string;
  /** Priority of the atendimento: the order the treatments are read in. */
  precedencia: number | null;
  estado: string;
  obs: string | null;
  /** Acolher com Amor only. */
  distonia: string | null;
  queixas: string[];
}

/** A treatment as filled in on the registration screen. */
export interface TreatmentInput {
  /** Row of `cepzk_atendimento` (sector + schedule). */
  atendimentoId: number | null;
  distoniaId: number | null;
  queixaIds: number[];
  obs: string;
}

// -----------------------------------------------------------------------------
// Treatment state
//
// `cepzk_tratamento.estado` is free text; these are the values the
// platform writes and the order they are read in — who is waiting comes
// first, who was discharged goes last.
// -----------------------------------------------------------------------------

export const ESTADO_PENDENTE = "pendente";
export const ESTADO_EM_TRATAMENTO = "em tratamento";
export const ESTADO_ALTA = "alta";

export const TREATMENT_STATE_ORDER = [
  ESTADO_PENDENTE,
  ESTADO_EM_TRATAMENTO,
  ESTADO_ALTA,
] as const;

/** Accent/case insensitive, so "Alta" and "alta" are the same state. */
function normalizeState(estado: string): string {
  return estado
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** `completo` is what the first version of the schema wrote for "alta". */
const STATE_ALIASES: Record<string, string> = {
  completo: ESTADO_ALTA,
  concluido: ESTADO_ALTA,
  "em atendimento": ESTADO_EM_TRATAMENTO,
};

export function canonicalState(estado: string): string {
  const normalized = normalizeState(estado);
  return STATE_ALIASES[normalized] ?? normalized;
}

export function isState(estado: string, expected: string): boolean {
  return canonicalState(estado) === canonicalState(expected);
}

/**
 * Sort key: pendente, em tratamento, alta — unknown states go just
 * before the discharged ones, so nobody disappears at the bottom.
 */
export function treatmentStateRank(estado: string | null | undefined): number {
  if (!estado) return TREATMENT_STATE_ORDER.length;
  const position = TREATMENT_STATE_ORDER.indexOf(
    canonicalState(estado) as (typeof TREATMENT_STATE_ORDER)[number],
  );
  return position === -1 ? TREATMENT_STATE_ORDER.length - 0.5 : position;
}

/** "Situação: pendente" — the state as recorded in `cepzk_tratamento`. */
export function treatmentStateLabel(estado: string): string {
  return `Situação: ${estado}`;
}

/**
 * The state change offered to the team that runs the treatment:
 *
 * - Desobsessão Infantil discharges the child ("Dar Alta"), from any
 *   state that is not already an alta;
 * - Acolher com Amor starts a treatment that is still waiting.
 *
 * Used both by the screen (to draw the button) and by the Server Action
 * (to decide whether the write is allowed), so the two cannot drift.
 */
export function treatmentStateAction(
  setor: string,
  estado: string,
): { nextState: string; label: string } | null {
  if (isDesobsessaoInfantil(setor) && !isState(estado, ESTADO_ALTA)) {
    return { nextState: ESTADO_ALTA, label: "Dar Alta" };
  }
  if (isAcolherComAmor(setor) && isState(estado, ESTADO_PENDENTE)) {
    return { nextState: ESTADO_EM_TRATAMENTO, label: "Iniciar Tratamento" };
  }
  return null;
}

/**
 * The assistidos list: one row per person, carrying the most pending
 * state among the treatments this volunteer may see, ordered by state
 * (pendente, em tratamento, alta) and then alphabetically.
 *
 * `assistidos` is empty for who only sees their own atendimentos — the
 * names then come from the treatments themselves.
 */
export function buildAssistidoList(
  assistidos: Assistido[],
  treatments: {
    assistido_id: number;
    estado: string;
    nome_completo?: string | null;
  }[],
): AssistidoListItem[] {
  const byId = new Map<number, AssistidoListItem>();

  for (const assistido of assistidos) {
    byId.set(assistido.id, { ...assistido, estado: null });
  }

  for (const row of treatments) {
    const current = byId.get(row.assistido_id) ?? {
      id: row.assistido_id,
      nome_completo: row.nome_completo ?? "—",
      estado: null,
    };

    const isMorePending =
      current.estado === null ||
      treatmentStateRank(row.estado) < treatmentStateRank(current.estado);

    byId.set(row.assistido_id, {
      ...current,
      estado: isMorePending ? row.estado : current.estado,
    });
  }

  // O Postgres ordena por byte, que joga "Ângela" para depois de
  // "Zulmira": a ordem alfabética é feita aqui, em pt-BR.
  return [...byId.values()].sort(
    (a, b) =>
      treatmentStateRank(a.estado) - treatmentStateRank(b.estado) ||
      a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
  );
}

/** Desobsessão Infantil I and II. */
export function isDesobsessaoInfantil(setor: string): boolean {
  return normalizeState(setor).startsWith(
    normalizeState(DESOBSESSAO_INFANTIL_SECTOR),
  );
}

export function isAcolherComAmor(setor: string): boolean {
  return normalizeState(setor) === normalizeState(ACA_SECTOR);
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
