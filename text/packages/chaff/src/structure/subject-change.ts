import type { Token } from "../plugin.ts";

// Whether a joining word ("and") starts a clause about another subject: "Revenue was $1,000 in 2025 and costs were $1,500
// in 2026" joins two subjects, "… in 2025 and $1,500 in 2026" or "… and revenue was $1,500" one. Two words for one thing
// ("sales" and "revenue") read as two subjects, so the pair is left alone rather than read wrongly. Pure: reads the tagger's
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
 * The joining word at index is followed by a noun the sentence has not used before it: "and costs were", "and costs $1,500"
 * after "Revenue was $1,000", where "and revenue was" after "ACME's revenue was $1,000" names the same thing again. A
 * sentence with no noun before the joining word gives nothing to compare with.
 */
export const startsOtherSubject = (tokens: readonly Token[], index: number): boolean => {
  const next = leadingNoun(tokens.slice(index + 1));
  const before = tokens
    .slice(0, index)
    .filter((token) => NOUN.has(token.pos))
    .map(wordOf);
  return next !== undefined && before.length > 0 && !before.includes(wordOf(next));
};
