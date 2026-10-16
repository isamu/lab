// Where a lower-case word that a defined term shares is the ordinary word in a phrase of its own, not the term, and where
// a quoted term is named rather than used. Pure: the tokens, the source and the lexicons' words are passed in.
import type { Token } from "../plugin.ts";

/** Words that narrow a noun into a kind of its own (a common parent, a limited liability company). */
const NARROWING = new Set(["ADJ", "NOUN"]);
const LOWER_START = /^\p{Ll}/u;
/** How far back from an opening quote the words that name it as a term are looked for. */
const CUE_LOOK_BACK = 40;
const LETTER = /\p{L}/u;
const LATIN = /\p{Script=Latin}/u;

/**
 * An adjective or a noun of the same Latin-script phrase right before the use narrows it into a phrase of its own (the
 * common parent, a limited liability company), unless it is a word that points at the defined thing (the other party).
 */
export const isNarrowedUse = (tokens: readonly Token[], at: number, pointers: readonly string[]): boolean => {
  const before = tokens[at - 1];
  if (before === undefined || !NARROWING.has(before.pos) || !LATIN.test(before.surface)) return false;
  return !pointers.some((pointer) => pointer.toLowerCase() === before.surface.toLowerCase());
};

/**
 * The use heads a phrase that names a kind of thing with "of" and a bare noun (certificates of deposit, letters of credit);
 * "of" followed by an article, a pronoun or a name (the certificate of the Company) is the defined thing again.
 * last is the index of the use's last token.
 */
export const headsKindPhrase = (tokens: readonly Token[], last: number): boolean => {
  const of = tokens[last + 1];
  const noun = tokens[last + 2];
  return of !== undefined && noun !== undefined && of.surface.toLowerCase() === "of" && noun.pos === "NOUN" && LOWER_START.test(noun.surface);
};

/** Every position of part inside whole, overlapping ones too. */
const positionsOf = (whole: string, part: string): number[] =>
  Array.from({ length: whole.length }, (_, index) => index).filter((index) => part !== "" && whole.startsWith(part, index));

/** The use sits inside another defined term written out in any case (certificate of merger, where Certificate of Merger is defined). */
export const insideLongerTerm = (source: string, offset: number, term: string, defined: readonly string[]): boolean =>
  defined.some((longer) => {
    if (longer.length <= term.length) return false;
    const lowerLonger = longer.toLowerCase();
    return positionsOf(lowerLonger, term.toLowerCase()).some((at) => {
      const start = offset - at;
      return start >= 0 && source.slice(start, start + longer.length).toLowerCase() === lowerLonger;
    });
  });

/**
 * A quoted term that the words before its opening quote name as a term (the definition of "Material Adverse Effect",
 * the term "Affiliate"): the term is mentioned, not used again. opening is the offset of the opening quote.
 */
export const isNamedAsTerm = (source: string, opening: number, cues: readonly string[]): boolean => {
  const before = source
    .slice(Math.max(0, opening - CUE_LOOK_BACK), opening)
    .trimEnd()
    .toLowerCase();
  return cues.some((cue) => {
    const lower = cue.toLowerCase();
    return lower !== "" && before.endsWith(lower) && !LETTER.test(before.charAt(before.length - lower.length - 1));
  });
};
