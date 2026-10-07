import type { Token } from "../plugin.ts";

// Whether a joining word ("and") starts a clause about another subject: "Revenue was $1,000 in 2025 and costs were $1,500
// in 2026" joins two subjects, "… in 2025 and $1,500 in 2026" or "… and revenue was $1,500" one. Pure: reads the tagger's
// parts of speech and lemmas.

const NOUN: ReadonlySet<string> = new Set(["NOUN", "PROPN"]);
/** Words that may stand before the noun that starts the clause ("and the costs", "and our operating costs"). */
const BEFORE_NOUN: ReadonlySet<string> = new Set(["DET", "ADJ", "PRON"]);

const wordOf = (token: Token): string => (token.lemma ?? token.surface).toLowerCase();

/** The last noun of the run of nouns at the start of tokens, past determiners and adjectives ("the operating costs" → cost). */
const leadingNoun = (tokens: readonly Token[]): Token | undefined => {
  const start = tokens.findIndex((token) => !BEFORE_NOUN.has(token.pos));
  if (start < 0) return undefined;
  const end = tokens.slice(start).findIndex((token) => !NOUN.has(token.pos));
  const nouns = tokens.slice(start, end < 0 ? tokens.length : start + end);
  return nouns.at(-1);
};

/**
 * The joining word at index is followed by a noun other than the sentence's subject (the first noun run before it). A noun
 * the sentence has not used before it starts another clause: "and costs were", "and costs $1,500".
 */
export const startsOtherSubject = (tokens: readonly Token[], index: number): boolean => {
  const next = leadingNoun(tokens.slice(index + 1));
  const subject = leadingNoun(tokens.slice(0, index));
  return next !== undefined && subject !== undefined && wordOf(next) !== wordOf(subject);
};
