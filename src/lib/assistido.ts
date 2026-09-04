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
export const DESOBSESSAO_INFANTIL_I_SECTOR = "Desobsessão Infantil I";
export const DESOBSESSAO_INFANTIL_II_SECTOR = "Desobsessão Infantil II";

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

/** An existing treatment, just enough to decide whether it blocks a repeat. */
export interface ExistingTreatmentRow {
  atendimento_id: number | null;
  /** Set when the treatment was archived; null while it is active. */
  data_arquivamento: string | null;
}

/**
 * Whether a new treatment may repeat an atendimento the assistido already
 * has — allowed only when every existing treatment of that atendimento is
 * archived. Without any existing treatment for the atendimento it is
 * trivially allowed (a fresh registration).
 */
export function canRepeatAtendimento(
  existing: ExistingTreatmentRow[],
  atendimentoId: number,
): boolean {
  const rows = existing.filter((row) => row.atendimento_id === atendimentoId);
  return rows.every((row) => row.data_arquivamento !== null);
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
export const ESTADO_EXPIRADO = "expirado";

export const TREATMENT_STATE_ORDER = [
  ESTADO_PENDENTE,
  ESTADO_EM_TRATAMENTO,
  ESTADO_ALTA,
  ESTADO_EXPIRADO,
] as const;

/**
 * Tailwind classes of the state chips, in pastel tones: pendente is
 * yellow, em tratamento is blue, alta is green and expirado is red.
 */
export const TREATMENT_STATE_COLORS: Record<string, string> = {
  [ESTADO_PENDENTE]: "bg-yellow-100 text-yellow-800",
  [ESTADO_EM_TRATAMENTO]: "bg-blue-100 text-blue-800",
  [ESTADO_ALTA]: "bg-green-100 text-green-800",
  [ESTADO_EXPIRADO]: "bg-red-100 text-red-800",
};

/** Accent/case insensitive, so "Alta" and "alta" are the same state. */
function normalizeState(estado: string): string {
  return estado
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function canonicalState(estado: string): string {
  return normalizeState(estado);
}

export function isState(estado: string, expected: string): boolean {
  return canonicalState(estado) === canonicalState(expected);
}

/**
 * Sort key: pendente, em tratamento, alta.
 *
 * The states between these will be filled in later, so anything unknown
 * sits just before the discharged ones — a new state never disappears at
 * the bottom of the list.
 */
export function treatmentStateRank(estado: string | null | undefined): number {
  if (!estado) return TREATMENT_STATE_ORDER.length;
  const position = TREATMENT_STATE_ORDER.indexOf(
    canonicalState(estado) as (typeof TREATMENT_STATE_ORDER)[number],
  );
  // Um estado ainda não previsto entra logo antes da alta: aparece na
  // lista com quem ainda está em tratamento, não no fim junto das altas.
  return position === -1
    ? TREATMENT_STATE_ORDER.indexOf(ESTADO_ALTA) - 0.5
    : position;
}

/**
 * The state as displayed on a chip — just the state, with a capitalized
 * first letter: "pendente" → "Pendente", "em tratamento" → "Em
 * tratamento". The word "Situação" is not repeated on every chip.
 */
export function treatmentStateChip(estado: string): string {
  if (!estado) return estado;
  return estado.charAt(0).toUpperCase() + estado.slice(1);
}

/** Tailwind classes for the colored state chip. Falls back to slate. */
export function treatmentStateColorClass(estado: string | null | undefined): string {
  if (!estado) return "bg-slate-100 text-slate-700";
  return (
    TREATMENT_STATE_COLORS[canonicalState(estado)] ??
    "bg-slate-100 text-slate-700"
  );
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
 * The assistidos list: one row per person, carrying the state of the
 * treatment that governs it, ordered by state (pendente, em tratamento,
 * alta) and then alphabetically.
 *
 * When there is more than one treatment, the **most pending** one wins.
 * Outside the Atendimento Fraterno the list only carries the treatments
 * of the volunteer's own escala, so the assistido reaches the end of the
 * list exactly when everything that is theirs is in alta — a volunteer
 * scheduled for several atendimentos does not lose sight of the ones
 * still open because of a single discharge.
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

    const governs =
      current.estado === null ||
      treatmentStateRank(row.estado) < treatmentStateRank(current.estado);

    byId.set(row.assistido_id, {
      ...current,
      estado: governs ? row.estado : current.estado,
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

/**
 * One treatment as needed to compute the Acolher com Amor waiting list:
 * just enough to find, per assistido, the pendente treatment of lowest
 * precedência (their "next treatment").
 */
export interface AcaWaitlistTreatmentRow {
  assistido_id: number;
  estado: string;
  /** Priority of the atendimento: lower = next. Null sorts last. */
  precedencia: number | null;
  setor: string;
  data_atualizacao: string;
}

/** One assistido in the Acolher com Amor waiting list. */
export interface AcaWaitlistItem extends Assistido {
  /** `data_atualizacao` of their pendente Acolher com Amor treatment. */
  dataAtualizacao: string;
}

/**
 * The Acolher com Amor waiting list: assistidos whose next treatment —
 * the pendente treatment of lowest precedência — is the Acolher com
 * Amor, ordered by that treatment's `data_atualizacao`, descending.
 *
 * A treatment only counts as "next" while it is still pendente: once it
 * moves to "em tratamento" or "alta" it stops competing for the lowest
 * precedência, and once resolved for the assistido it also stops being
 * eligible for this list.
 */
export function buildAcaWaitlist(
  assistidos: Assistido[],
  treatments: AcaWaitlistTreatmentRow[],
): AcaWaitlistItem[] {
  const pendingByAssistido = new Map<number, AcaWaitlistTreatmentRow[]>();

  for (const row of treatments) {
    if (!isState(row.estado, ESTADO_PENDENTE)) continue;
    const rows = pendingByAssistido.get(row.assistido_id) ?? [];
    rows.push(row);
    pendingByAssistido.set(row.assistido_id, rows);
  }

  const names = new Map(
    assistidos.map((assistido) => [assistido.id, assistido.nome_completo]),
  );

  const waitlist: AcaWaitlistItem[] = [];

  for (const [assistidoId, rows] of pendingByAssistido) {
    // O próximo tratamento é o pendente de menor precedência; sem
    // precedência definida, ele não compete pelo primeiro lugar.
    const next = rows.reduce((best, row) =>
      (row.precedencia ?? Number.MAX_SAFE_INTEGER) <
      (best.precedencia ?? Number.MAX_SAFE_INTEGER)
        ? row
        : best,
    );

    if (!isAcolherComAmor(next.setor)) continue;

    waitlist.push({
      id: assistidoId,
      nome_completo: names.get(assistidoId) ?? "—",
      dataAtualizacao: next.data_atualizacao,
    });
  }

  return waitlist.sort(
    (a, b) =>
      new Date(b.dataAtualizacao).getTime() -
        new Date(a.dataAtualizacao).getTime() ||
      a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
  );
}

/** Desobsessão Infantil I and II. */
export function isDesobsessaoInfantil(setor: string): boolean {
  return isDesobsessaoInfantilI(setor) || isDesobsessaoInfantilII(setor);
}

export function isDesobsessaoInfantilI(setor: string): boolean {
  // "Desobsessão Infantil I" matches exactly; "Desobsessão Infantil" (no
  // suffix) counts as I for backward compatibility with existing rows.
  const normalized = normalizeState(setor);
  return (
    normalized === normalizeState(DESOBSESSAO_INFANTIL_I_SECTOR) ||
    normalized === normalizeState(DESOBSESSAO_INFANTIL_SECTOR)
  );
}

export function isDesobsessaoInfantilII(setor: string): boolean {
  return normalizeState(setor) === normalizeState(DESOBSESSAO_INFANTIL_II_SECTOR);
}

/** Whether a treatment belongs to a specific sector (case/diacritic-insensitive). */
export function isSector(setor: string, expected: string): boolean {
  return normalizeState(setor) === normalizeState(expected);
}

export function isAcolherComAmor(setor: string): boolean {
  return isSector(setor, ACA_SECTOR);
}

/**
 * An entry in the Desobsessão Infantil assistidos list: the assistido plus
 * the state of the most recent (by `data_atualizacao`) non-archived
 * treatment of the team's sector.
 */
export interface DesobsessaoInfantilListItem extends Assistido {
  estado: string | null;
  /** The relevant (most recent, non-archived) treatment id. */
  treatmentId: number | null;
}

interface TreatmentRowForDI {
  id: number;
  assistido_id: number;
  estado: string;
  data_atualizacao: string | null;
  data_arquivamento: string | null;
  setor: string;
  nome_completo?: string | null;
  assistido_data_arquivamento?: string | null;
}

/**
 * Build the active list for a Desobsessão Infantil team: the assistidos
 * who are not archived and have at least one non-archived treatment that
 * matches `sectorMatcher`. Sorted alphabetically by name. The row's
 * estado is the **most recent** treatment's estado.
 *
 * The matcher is a predicate (rather than a plain sector name) so that
 * the caller can include legacy rows such as "Desobsessão Infantil"
 * (without the "I" suffix) in the Desobsessão Infantil I view.
 */
export function buildDesobsessaoInfantilList(
  rows: TreatmentRowForDI[],
  sectorMatcher: string | ((setor: string) => boolean),
): DesobsessaoInfantilListItem[] {
  const matches =
    typeof sectorMatcher === "function"
      ? sectorMatcher
      : (setor: string) => isSector(setor, sectorMatcher);

  const bestById = new Map<number, {
    item: DesobsessaoInfantilListItem;
    updatedAt: number;
  }>();

  for (const row of rows) {
    // Arquivados (assistido ou tratamento) não entram nesta lista.
    if (row.data_arquivamento) continue;
    if (row.assistido_data_arquivamento) continue;
    if (!matches(row.setor)) continue;

    const updatedAt = row.data_atualizacao
      ? new Date(row.data_atualizacao).getTime()
      : 0;
    const existing = bestById.get(row.assistido_id);

    if (!existing || updatedAt > existing.updatedAt) {
      bestById.set(row.assistido_id, {
        item: {
          id: row.assistido_id,
          nome_completo: row.nome_completo ?? "—",
          estado: row.estado,
          treatmentId: row.id,
        },
        updatedAt,
      });
    }
  }

  return [...bestById.values()]
    .map(({ item }) => item)
    .sort((a, b) =>
      a.nome_completo.localeCompare(b.nome_completo, "pt-BR"),
    );
}

// -----------------------------------------------------------------------------
// Name matching
//
// Registering someone twice is the mistake this screen exists to prevent, so
// the check has to catch the same name typed differently — "Luccas Silva" has
// to find "Luca Silva" — while staying quiet about two people who merely share
// a surname, which is how "João Silva" and "Lucas Silva" used to look alike.
//
// No single score over the whole string does both: the shared surname carries
// the score, whatever the metric. Names are compared one by one instead — see
// docs/similaridade-de-nomes.md, which measured this rule against every
// alternative (metric by metric, library by library, and in the database).
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

/** Names kept for display: accent-free, without particles. */
function nameTokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token && !NAME_PARTICLES.has(token));
}

/** "Júnior" and friends tell generations apart, not people. */
const NAME_GENERATIONS = new Set([
  "junior",
  "jr",
  "filho",
  "neto",
  "segundo",
  "terceiro",
  "sobrinho",
  "senior",
]);

/**
 * Spellings Brazilian registries swap freely, folded into a single form:
 * Thiago/Tiago, Wagner/Vagner, Souza/Sousa, Kleber/Cleber, Yara/Iara,
 * Gisele/Giselle, Luccas/Lucas, Fabrício/Fabrizio, Cecília/Sesília.
 *
 * "x" is left alone on purpose — folding it into "s" would make "Alexandra"
 * and "Alessandra" indistinguishable, and they are usually different people.
 *
 * The order matters: "ph" has to be read before the silent "h" goes away, and
 * the "c" that sounds like "s" before the doubled letters are collapsed.
 */
const NAME_FOLDINGS: readonly [pattern: RegExp, replacement: string][] = [
  [/ph/g, "f"],
  [/h/g, ""],
  [/y/g, "i"],
  [/w/g, "v"],
  [/k/g, "c"],
  [/z/g, "s"],
  [/c(?=[ei])/g, "s"],
  [/([a-z])\1/g, "$1"],
];

/**
 * How close two names of different lengths have to be to count as the same
 * one. Measured over the pairs in docs/similaridade-de-nomes.md: below it
 * "Luca" drifts into "Luciana", above it "Luccas" stops finding "Luca".
 */
export const NAME_MATCH_THRESHOLD = 0.86;

/** Two neighbour letters typed in the wrong order: clearly the same name. */
const TRANSPOSITION_SCORE = 0.95;

/** A letter swapped for one of the other kind: a slip, not another name. */
const SLIP_SCORE = 0.9;

/** An initial ("J.") only says what the name starts with: weaker evidence. */
const INITIAL_SCORE = 0.5;

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

/** One name of a full name, as it is read and as it is compared. */
interface NameToken {
  /** Accent-free and lowercase, for showing on screen. */
  written: string;
  /** `written` with the spelling variants folded, for comparing. */
  folded: string;
}

/** The names that identify someone: particles and generation suffixes out. */
function compareTokens(value: string): NameToken[] {
  return (
    normalizeName(value)
      .split(" ")
      .filter(
        (token) =>
          token && !NAME_PARTICLES.has(token) && !NAME_GENERATIONS.has(token),
      )
      .map((written) => ({
        written,
        folded: NAME_FOLDINGS.reduce(
          (folded, [pattern, replacement]) =>
            folded.replace(pattern, replacement),
          written,
        ),
      }))
      // Folding a name down to nothing ("H") leaves nothing to compare.
      .filter((token) => token.folded.length > 0)
  );
}

/** The letters two words share in order: their longest common subsequence. */
function sharedLetters(a: string, b: string): number {
  let previous = new Array<number>(b.length + 1).fill(0);
  let current = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    current[0] = 0;
    for (let j = 1; j <= b.length; j++) {
      current[j] =
        a[i - 1] === b[j - 1]
          ? previous[j - 1] + 1
          : Math.max(previous[j], current[j - 1]);
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length];
}

/**
 * Similarity from 0 to 1 counting only letters added or dropped, so that a
 * replaced letter costs both and barely moves the score.
 *
 * That is the point: Brazilian spelling variants add or drop letters
 * ("Luccas"/"Luca", "Aparecida"/"Apparecida"), while a different name usually
 * replaces them ("Eduardo"/"Eduarda", "Lima"/"Lira").
 */
function indelSimilarity(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  return (2 * sharedLetters(a, b)) / (a.length + b.length);
}

/** The positions where two words of the same length differ. */
function differingPositions(a: string, b: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) positions.push(i);
  }
  return positions;
}

/**
 * How alike two single names are, from 0 (not the same name) to 1 (the same
 * spelling).
 *
 * Words of the same length cannot have gained or lost a letter, so a
 * difference there is either a slip of the fingers or another name:
 *
 * - two neighbours in the wrong order ("Nogueira"/"Nogreira") is a slip;
 * - one letter swapped for one of the other kind, vowel for consonant
 *   ("Sônia"/"Sonja"), is a slip;
 * - a vowel for a vowel is a gender or a different name ("Eduardo"/"Eduarda",
 *   "Mariana"/"Mariane"), and a consonant for a consonant is a different
 *   surname ("Lima"/"Lira", "Alessandra"/"Alexandra").
 */
function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;

  if (a.length === 1 || b.length === 1) {
    const initial = a.length === 1 ? a : b;
    const name = a.length === 1 ? b : a;
    return name.startsWith(initial) ? INITIAL_SCORE : 0;
  }

  if (a.length !== b.length) {
    const similarity = indelSimilarity(a, b);
    return similarity >= NAME_MATCH_THRESHOLD ? similarity : 0;
  }

  const positions = differingPositions(a, b);
  if (positions.length === 2 && positions[1] === positions[0] + 1) {
    const swapped =
      a[positions[0]] === b[positions[1]] &&
      a[positions[1]] === b[positions[0]];
    if (swapped) return TRANSPOSITION_SCORE;
  }

  if (positions.length === 1) {
    const from = a[positions[0]];
    const to = b[positions[0]];
    if (VOWELS.has(from) !== VOWELS.has(to)) return SLIP_SCORE;
  }

  return 0;
}

/** A name that is spelled differently on each side. */
export interface NameDifference {
  /** As the volunteer typed it. */
  typed: string;
  /** As it is registered. */
  registered: string;
}

export interface NameComparison {
  /** Whether both names are the same person, spelled differently. */
  similar: boolean;
  /** 0 to 1, how close the paired names are — the list is ordered by it. */
  score: number;
  /** Names spelled differently; empty when only accents or particles are. */
  differences: NameDifference[];
}

/** "luccas" reads better as "Luccas" inside a sentence. */
function sentenceCase(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1);
}

/**
 * Whether the name being typed and a registered name are the same person.
 *
 * Every name of one side needs a partner on the other, and the first name and
 * the last surname need one in their own place: sharing a surname is not
 * enough ("João Silva"/"Lucas Silva"), and neither is sharing a first name
 * ("Ana Paula Ferreira"/"Ana Luiza Ferreira").
 */
export function compareNames(
  typed: string,
  registered: string,
): NameComparison {
  const typedTokens = compareTokens(typed);
  const registeredTokens = compareTokens(registered);
  const different: NameComparison = {
    similar: false,
    score: 0,
    differences: [],
  };

  if (!typedTokens.length || !registeredTokens.length) return different;

  const taken = new Array<boolean>(registeredTokens.length).fill(false);
  const scores: number[] = [];
  const differences: NameDifference[] = [];

  for (const token of typedTokens) {
    let best = 0;
    let partner = -1;

    for (let i = 0; i < registeredTokens.length; i++) {
      if (taken[i]) continue;
      const score = tokenSimilarity(token.folded, registeredTokens[i].folded);
      if (score > best) {
        best = score;
        partner = i;
      }
    }

    // A name nobody answers to belongs to someone else.
    if (partner < 0) return different;

    taken[partner] = true;
    scores.push(best);

    const matched = registeredTokens[partner];
    if (token.written !== matched.written) {
      differences.push({ typed: token.written, registered: matched.written });
    }
  }

  const comparison = {
    similar: true,
    score: scores.reduce((total, score) => total + score, 0) / scores.length,
    differences,
  };

  // With the same number of names on both sides, every name found a partner
  // and the order they were typed in does not matter — "Silva João" is "João
  // Silva" written backwards. With a different number, the pairing above only
  // says the shorter side is contained in the longer one, so the two names
  // that carry the identity have to match where they are: without that, "Ana"
  // would find every "Ana …" in the registry.
  if (typedTokens.length === registeredTokens.length) return comparison;

  const firstName = tokenSimilarity(
    typedTokens[0].folded,
    registeredTokens[0].folded,
  );
  const surname = tokenSimilarity(
    typedTokens[typedTokens.length - 1].folded,
    registeredTokens[registeredTokens.length - 1].folded,
  );

  return firstName && surname ? comparison : different;
}

/** Why a registered name came up, in the words the volunteer reads. */
export function similarityReason(comparison: NameComparison): string {
  if (!comparison.differences.length) {
    return "Mesmo nome, com outros acentos, partículas ou sufixos.";
  }

  const spelled = comparison.differences
    .map(
      (difference) =>
        `“${sentenceCase(difference.typed)}” e “${sentenceCase(
          difference.registered,
        )}”`,
    )
    .join(", ");

  return `Grafia parecida em ${spelled}.`;
}

export interface SimilarAssistido extends Assistido {
  /** 0 to 1, how close the names are — the review list is ordered by it. */
  score: number;
  /** Why this name came up, to be read next to it. */
  reason: string;
}

/** The registered names that look like `query`, closest first. */
export function findSimilarNames(
  query: string,
  candidates: Assistido[],
  limit = 8,
): SimilarAssistido[] {
  return candidates
    .flatMap((candidate) => {
      const comparison = compareNames(query, candidate.nome_completo);
      if (!comparison.similar) return [];
      return [
        {
          ...candidate,
          score: comparison.score,
          reason: similarityReason(comparison),
        },
      ];
    })
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
