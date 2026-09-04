import { describe, expect, it } from "vitest";
import {
  assistidoInitials,
  canRepeatAtendimento,
  compareNames,
  findSimilarNames,
  NAME_MATCH_THRESHOLD,
  normalizeName,
  similarityReason,
  type Assistido,
} from "./assistido";

/**
 * The labelled pairs measured in docs/similaridade-de-nomes.md. They are the
 * reason the old score (Sørensen–Dice over the whole name, threshold 0.35) was
 * replaced: it pointed at one name in two that was not the same person.
 */

/** Same person, spelled differently — has to be offered for review. */
const SAME_PERSON: [typed: string, registered: string][] = [
  ["Luccas Silva", "Luca Silva"],
  ["João Silva", "Joao da Silva"],
  ["Maria Aparecida Souza", "Maria Aparecida de Souza"],
  ["José Carlos Pereira", "Jose Carlos Pereira"],
  ["Francisco Oliveira", "Francisco de Oliveira"],
  ["Ana Beatriz Nogueira", "Ana Beatriz Nogreira"],
  ["Carlos Eduardo Santos", "Carlos Eduardo dos Santos"],
  ["Márcia Regina Lima", "Marcia Regina de Lima"],
  ["Wagner Souza", "Vagner Souza"],
  ["Joao Batista Ferreira", "João Batista Ferreira Júnior"],
  ["Reginaldo Assunção", "Reginaldo Assuncão"],
  ["Kleber Andrade", "Cleber Andrade"],
  ["Marcos Sousa", "Marcos Souza"],
  ["Thiago Ribeiro", "Tiago Ribeiro"],
  ["Christiane Lopes", "Cristiane Lopes"],
  ["Gisele Moraes", "Giselle Moraes"],
  ["Luiz Fernando Gomes", "Luis Fernando Gomes"],
  ["Teresa Batista", "Tereza Batista"],
  ["Cesar Augusto", "Cezar Augusto"],
  ["Vanderlei Costa", "Wanderley Costa"],
  ["Aparecida Ramos", "Apparecida Ramos"],
  ["Fabrício Nunes", "Fabrizio Nunes"],
  ["Sônia Peixoto", "Sonja Peixoto"],
];

/** Different people — must not disturb whoever is registering. */
const DIFFERENT_PEOPLE: [typed: string, registered: string][] = [
  ["João Silva", "Lucas Silva"],
  ["Luccas Silva", "Luca Silveira"],
  ["Ana Paula Ferreira", "Ana Luiza Ferreira"],
  ["Francisco Oliveira", "Francislei Oliveira"],
  ["Maria Silva", "José Silva"],
  ["Pedro Santos", "Paulo Santos"],
  ["Antonio Pereira", "Antonio Peres"],
  ["Silvia Ramos", "Silvana Ramos"],
  ["Marcos Vinicius Almeida", "Marcos Aurelio Almeida"],
  ["Joana Darc Souza", "Joana Souza Lima"],
  ["Rosangela Costa", "Rosana Costa"],
  ["Ivanildo Prado", "Ivan Prado"],
  ["Alessandra Rodrigues", "Alexandra Rodrigues"],
  ["Rafael Lima", "Rafael Lira"],
  ["Eduarda Melo", "Eduardo Melo"],
  ["Mariana Castro", "Mariane Castro"],
  ["Juliana Prado", "Juliano Prado"],
  ["Ivan Teixeira", "Ivo Teixeira"],
  ["Sonia Braga", "Soraia Braga"],
  ["Renato Aragao", "Renata Aragao"],
  ["Claudio Nunes", "Claudia Nunes"],
  ["Marcio Sales", "Marcelo Sales"],
];

/**
 * Pairs where either answer is defensible. They are pinned down so that a
 * change of behaviour is a decision, not a surprise.
 */
const JUDGEMENT_CALLS: [typed: string, registered: string, similar: boolean][] =
  [
    // An incomplete name is not enough to accuse a duplicate.
    ["João", "João Silva", false],
    // A different last name is a different person, however close the rest is.
    ["Ana Maria", "Ana Maria do Carmo", false],
    // An initial stands for the name it starts.
    ["Jose Antonio Silva", "Jose A. Silva", true],
    // Short forms and nicknames are out of reach of any spelling rule.
    ["Beth Souza", "Elizabeth Souza", false],
    ["Marco Lima", "Marcos Lima", true],
    ["Sebastiana Rocha", "Sebastiao Rocha", false],
  ];

function assistido(id: number, nomeCompleto: string): Assistido {
  return { id, nome_completo: nomeCompleto };
}

describe("the three cases that motivated the change", () => {
  it("does not take João Silva for Lucas Silva", () => {
    expect(compareNames("João Silva", "Lucas Silva").similar).toBe(false);
  });

  it("takes Luccas Silva for Luca Silva", () => {
    expect(compareNames("Luccas Silva", "Luca Silva").similar).toBe(true);
  });

  it("does not take Luccas Silva for Luca Silveira", () => {
    expect(compareNames("Luccas Silva", "Luca Silveira").similar).toBe(false);
  });
});

describe("the same person spelled differently", () => {
  it.each(SAME_PERSON)("%s ≈ %s", (typed, registered) => {
    expect(compareNames(typed, registered).similar).toBe(true);
    // Whoever is registered and whoever is typed cannot change the answer.
    expect(compareNames(registered, typed).similar).toBe(true);
  });

  it("ignores accents, punctuation, case and extra spaces", () => {
    expect(
      compareNames("  JOSÉ   CARLOS-PEREIRA ", "jose carlos pereira").similar,
    ).toBe(true);
    expect(
      compareNames("José Carlos Pereira", "JOSÉ CARLOS PEREIRA").differences,
    ).toEqual([]);
  });
});

describe("different people", () => {
  it.each(DIFFERENT_PEOPLE)("%s ≠ %s", (typed, registered) => {
    expect(compareNames(typed, registered).similar).toBe(false);
    expect(compareNames(registered, typed).similar).toBe(false);
  });
});

describe("judgement calls", () => {
  it.each(JUDGEMENT_CALLS)("%s × %s → %s", (typed, registered, similar) => {
    expect(compareNames(typed, registered).similar).toBe(similar);
  });
});

describe("compareNames", () => {
  it("scores an identical name as 1", () => {
    expect(compareNames("Ana Lima", "Ana Lima").score).toBe(1);
  });

  it("scores a spelling variant just below an identical name", () => {
    const identical = compareNames("Ana Lima", "Ana Lima").score;
    const variant = compareNames("Luccas Silva", "Luca Silva").score;
    const slip = compareNames(
      "Ana Beatriz Nogueira",
      "Ana Beatriz Nogreira",
    ).score;

    expect(variant).toBeLessThan(identical);
    expect(slip).toBeLessThan(identical);
    expect(variant).toBeGreaterThan(NAME_MATCH_THRESHOLD);
  });

  it("reports which names are spelled differently", () => {
    expect(compareNames("Luccas Silva", "Luca Silva").differences).toEqual([
      { typed: "luccas", registered: "luca" },
    ]);
    expect(
      compareNames("Ana Beatriz Nogueira", "Ana Beatriz Nogreira").differences,
    ).toEqual([{ typed: "nogueira", registered: "nogreira" }]);
  });

  it("reports no difference when only particles or suffixes moved", () => {
    expect(
      compareNames("João Batista Ferreira", "Joao Batista Ferreira Junior")
        .differences,
    ).toEqual([]);
  });

  it("needs both sides to have a name", () => {
    expect(compareNames("", "Ana Lima").similar).toBe(false);
    expect(compareNames("Ana Lima", "").similar).toBe(false);
    expect(compareNames("   ", "—").similar).toBe(false);
  });

  it("does not match everybody who shares the surname", () => {
    expect(compareNames("Ana", "Ana Paula Ferreira").similar).toBe(false);
    expect(compareNames("Silva", "Ana Silva").similar).toBe(false);
  });

  it("reads a name typed backwards, surname first", () => {
    expect(compareNames("Silva João", "João Silva").similar).toBe(true);
  });

  it("ignores the particles in the middle of a name", () => {
    expect(compareNames("Maria da Silva", "Maria Silva").similar).toBe(true);
  });

  it("matches an initial with the name it abbreviates", () => {
    expect(compareNames("J Silva", "Joao Silva").similar).toBe(true);
    expect(compareNames("J Silva", "Ana Silva").similar).toBe(false);
  });

  it("sorts out two people with the same first and last name", () => {
    expect(compareNames("Ana Maria Silva", "Ana Maria Silva").similar).toBe(
      true,
    );
    expect(compareNames("Ana Maria Silva", "Ana Lúcia Silva").similar).toBe(
      false,
    );
  });
});

describe("similarityReason", () => {
  it("says the spelling is the same when only accents or particles differ", () => {
    const comparison = compareNames(
      "José Carlos Pereira",
      "Jose Carlos de Pereira",
    );
    expect(comparison.similar).toBe(true);
    expect(similarityReason(comparison)).toBe(
      "Mesmo nome, com outros acentos, partículas ou sufixos.",
    );
  });

  it("points at the names that are spelled differently", () => {
    const comparison = compareNames("Luccas Silva", "Luca Silva");
    expect(similarityReason(comparison)).toBe(
      "Grafia parecida em “Luccas” e “Luca”.",
    );
  });

  it("lists every name that differs", () => {
    const comparison = compareNames(
      "Wanderley Costa Junior",
      "Vanderlei Costa",
    );
    expect(comparison.similar).toBe(true);
    expect(similarityReason(comparison)).toBe(
      "Grafia parecida em “Wanderley” e “Vanderlei”.",
    );
  });
});

describe("findSimilarNames", () => {
  const registered = [
    assistido(1, "Luca Silva"),
    assistido(2, "Lucas Silva"),
    assistido(3, "Luca Silveira"),
    assistido(4, "João Silva"),
    assistido(5, "Ana Lima"),
  ];

  it("keeps only the names that can be the same person", () => {
    const matches = findSimilarNames("Luccas Silva", registered);
    expect(matches.map((match) => match.id)).toEqual([2, 1]);
  });

  it("returns the closest name first — “Lucas” is “Luccas” folded", () => {
    const matches = findSimilarNames("Luccas Silva", registered);
    expect(matches.map((match) => match.nome_completo)).toEqual([
      "Lucas Silva",
      "Luca Silva",
    ]);
    expect(matches[0].score).toBe(1);
    expect(matches[0].score).toBeGreaterThan(matches[1].score);
  });

  it("explains every name it returns", () => {
    const matches = findSimilarNames("Luccas Silva", registered);
    expect(matches.map((match) => match.reason)).toEqual([
      "Grafia parecida em “Luccas” e “Lucas”.",
      "Grafia parecida em “Luccas” e “Luca”.",
    ]);
  });

  it("breaks ties alphabetically in Portuguese", () => {
    const matches = findSimilarNames("Ana Lima", [
      assistido(1, "Ana Lima"),
      assistido(2, "Ana Lima"),
    ]);
    expect(matches).toHaveLength(2);
    expect(matches.map((match) => match.id)).toEqual([1, 2]);
  });

  it("keeps at most `limit` names, the first ones in order", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      assistido(index + 1, "Ana Lima"),
    );
    expect(
      findSimilarNames("Ana Lima", many, 3).map((match) => match.id),
    ).toEqual([1, 2, 3]);
  });

  it("returns nothing when nobody looks alike", () => {
    expect(findSimilarNames("Zuleide Prado", registered)).toEqual([]);
  });

  it("does not write to the list it receives", () => {
    const before = JSON.stringify(registered);
    findSimilarNames("Luccas Silva", registered);
    expect(JSON.stringify(registered)).toBe(before);
  });
});

describe("the rest of the module", () => {
  it("normalizes a name for the list filters", () => {
    expect(normalizeName("  ÁNA-BEATRIZ  D'Ávila ")).toBe(
      "ana beatriz d avila",
    );
  });

  it("keeps taking the initials from the first and the last name", () => {
    expect(assistidoInitials("Maria de Lourdes Santos")).toBe("MS");
    expect(assistidoInitials("Ana")).toBe("A");
    expect(assistidoInitials("")).toBe("?");
  });
});

describe("canRepeatAtendimento", () => {
  const existing = [
    { atendimento_id: 1, data_arquivamento: "2026-01-01T00:00:00.000Z" },
    { atendimento_id: 1, data_arquivamento: "2026-02-01T00:00:00.000Z" },
    { atendimento_id: 2, data_arquivamento: null },
  ];

  it("allows repeating an atendimento whose treatments are all archived", () => {
    expect(canRepeatAtendimento(existing, 1)).toBe(true);
  });

  it("blocks repeating an atendimento that still has an active treatment", () => {
    expect(canRepeatAtendimento(existing, 2)).toBe(false);
  });

  it("allows an atendimento the assistido never had", () => {
    expect(canRepeatAtendimento(existing, 3)).toBe(true);
  });

  it("allows everything for a new assistido", () => {
    expect(canRepeatAtendimento([], 1)).toBe(true);
  });
});
