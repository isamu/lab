import type { Token } from "../plugin.ts";

/**
 * A numbered item that names something instead of telling the reader to do something: a list of cases (exclusions, causes,
 * conditions), not a procedure. The tagger reads an imperative at the head of a step as a noun (Click, Press), so the
 * part of speech alone does not tell them apart; the form does.
 */
const SKIPPED = new Set(["PUNCT", "NUM", "SYM", "X", "SPACE"]);
const NOUN_PHRASE_PART = new Set(["NOUN", "PROPN", "CCONJ"]);
const NOMINAL = new Set(["NOUN", "PROPN"]);

/** An imperative is the verb's base form. A head in another form (Faults, Repairs, Uses) is a plural noun or a third-person verb. */
const isInflectedHead = (head: Token): boolean => head.lemma !== undefined && head.lemma !== "" && head.surface.toLowerCase() !== head.lemma.toLowerCase();

/** A participle in its own form (caused, made), not a base form the tagger marked (Set). */
const isPastParticiple = (token: Token | undefined): boolean => token?.pos === "VERB" && token.features?.["VerbForm"] === "Part" && isInflectedHead(token);

/** Nouns joined by a conjunction (Faults or damage). Two nouns side by side may be an imperative and its object (Access files). */
const isJoinedNouns = (words: readonly Token[]): boolean =>
  words.length % 2 === 1 && words.every((token, at) => (at % 2 === 0 ? NOMINAL.has(token.pos) : token.pos === "CCONJ"));

/**
 * A noun, then a participle and a preposition (Damage caused by a drop, Loss incurred during shipping): the participle
 * describes the noun. An imperative's object comes after the verb (Copy saved files, Access files saved in a folder).
 */
const opensWithReducedClause = (words: readonly Token[]): boolean => {
  const participleAt = words.findIndex((token) => !NOUN_PHRASE_PART.has(token.pos));
  return participleAt > 0 && isJoinedNouns(words.slice(0, participleAt)) && isPastParticiple(words[participleAt]) && words[participleAt + 1]?.pos === "ADP";
};

export const opensAsNounPhrase = (tokens: readonly Token[]): boolean => {
  const words = tokens.filter((token) => !SKIPPED.has(token.pos));
  const head = words[0];
  return head !== undefined && (isInflectedHead(head) || opensWithReducedClause(words));
};
