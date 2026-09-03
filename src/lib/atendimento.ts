/**
 * Atendimentos: the sector + schedule combinations the house actually
 * offers (`cepzk_atendimento`).
 *
 * Before, escala and tratamento pointed to a sector and a schedule
 * separately, which allowed combinations that do not exist (Acolher com
 * Amor on a Tuesday morning). Now both point to a single atendimento.
 */

/** A row of `cepzk_atendimento`, already joined with the catalogues. */
export interface AtendimentoItem {
  id: number;
  setorId: number | null;
  setor: string;
  departamento: string | null;
  horario: string;
  /** Treatment priority (lower = more urgent); null = not defined. */
  precedencia: number | null;
}

/** Embed used everywhere an atendimento has to be read with its names. */
export const ATENDIMENTO_SELECT =
  "id, precedencia, setor:cepzk_setor (id, nome, departamento:cepzk_departamento (nome)), horario:cepzk_horario (nome)";

export interface AtendimentoRow {
  id: number;
  precedencia: number | null;
  setor:
    | {
        id: number;
        nome: string;
        departamento: { nome: string } | { nome: string }[] | null;
      }
    | {
        id: number;
        nome: string;
        departamento: { nome: string } | { nome: string }[] | null;
      }[]
    | null;
  horario: { nome: string } | { nome: string }[] | null;
}

/** PostgREST returns embedded rows as an object or as a single-item array. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function mapAtendimento(row: AtendimentoRow): AtendimentoItem {
  const setor = one(row.setor);
  return {
    id: row.id,
    setorId: setor?.id ?? null,
    setor: setor?.nome ?? "Setor",
    departamento: one(setor?.departamento)?.nome ?? null,
    horario: one(row.horario)?.nome ?? "—",
    precedencia: row.precedencia,
  };
}

/** "Acolher com Amor — Sábado 9h30", as shown in the selects. */
export function atendimentoLabel(atendimento: AtendimentoItem): string {
  return `${atendimento.setor} — ${atendimento.horario}`;
}

/**
 * Most urgent first, then alphabetically — the order the coordinators
 * read the list in.
 */
export function sortAtendimentos(items: AtendimentoItem[]): AtendimentoItem[] {
  return [...items].sort(
    (a, b) =>
      (a.precedencia ?? Number.MAX_SAFE_INTEGER) -
        (b.precedencia ?? Number.MAX_SAFE_INTEGER) ||
      a.setor.localeCompare(b.setor, "pt-BR") ||
      a.horario.localeCompare(b.horario, "pt-BR"),
  );
}
