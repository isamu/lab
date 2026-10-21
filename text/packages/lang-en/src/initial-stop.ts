import { escapeRegExp } from "./regexp.ts";

/**
 * sentence-splitter reads a capital and a full stop as an initial and never ends a sentence there: "Regulation C. The
 * Guide applies" and "Appendix B. In 2020 …" were one sentence. It also ends a sentence after an abbreviation such as
 * "U.S." before any capital, so "the U.S. Census Bureau" was two. Both are decided by the word after the full stop:
 * - capitals with full stops (C., D.C.) before a sentence-start-word (The, In) end the sentence. Their capitals are
 *   replaced with a plain letter, which the splitter does not read as an initial;
 * - a prepositive abbreviation (U.S.) before any other capitalised word does not end it, unless a comma follows that
 *   word ("in the U.S. Yesterday, …"). Its last full stop is replaced with a letter;
 * - a name abbreviation (Jas., Wm.) stands before a name, so it does not end it before any word but a
 *   sentence-start-word, even before a name and a comma ("Jas. Whittaker, J. Hocknell"). Its full stop is replaced
 *   with a letter.
 * The length does not change, so the spans fit the original text. Initials first on their line are a list's labels
 * (A. The first item) and are left as they are.
 */

export type InitialStops = { readonly ends: RegExp | undefined; readonly joins: RegExp | undefined; readonly names: RegExp | undefined };

const EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}_.'’])`;
const WORD_END = String.raw`(?![\p{L}\p{N}_.'’-])`;
const PLAIN_LETTER = "n";
const CAPITAL = /\p{Lu}/gu;

const oneOf = (words: readonly string[]): string => `(?:${words.map(escapeRegExp).join("|")})`;

const startOf = (startWords: readonly string[]): string | undefined => (startWords.length === 0 ? undefined : String.raw`\s+${oneOf(startWords)}${WORD_END}`);

const sentenceStops = (start: string | undefined, prepositive: readonly string[]): Pick<InitialStops, "ends" | "joins"> => {
  if (start === undefined) return { ends: undefined, joins: undefined };
  const ends = new RegExp(String.raw`${EDGE_BEFORE}(?:\p{Lu}\.){1,3}(?=${start})`, "gu");
  if (prepositive.length === 0) return { ends, joins: undefined };
  return { ends, joins: new RegExp(String.raw`${EDGE_BEFORE}${oneOf(prepositive)}(?=\s+\p{Lu})(?!${start})(?!\s+\p{Lu}\p{L}*,)`, "gu") };
};

// "I" is not a sentence-start word because it is also an initial (John I. Smith); after a name abbreviation the pronoun
// is told by having no full stop of its own.
const PRONOUN_I = String.raw`(?!\s+I${WORD_END})`;

const notBefore = (start: string | undefined): string => (start === undefined ? "" : `(?!${start})`);

/** A name abbreviation before any word but a sentence-start word or the pronoun I. */
const nameJoins = (start: string | undefined, names: readonly string[]): RegExp | undefined => {
  if (names.length === 0) return undefined;
  return new RegExp(String.raw`${EDGE_BEFORE}${oneOf(names)}(?=\s+\p{L})${PRONOUN_I}${notBefore(start)}`, "gu");
};

/** Built once from the lexicons. */
export const initialStops = (startWords: readonly string[], prepositive: readonly string[], names: readonly string[] = []): InitialStops => {
  const start = startOf(startWords);
  return { ...sentenceStops(start, prepositive), names: nameJoins(start, names) };
};

/** Only a list's marker, or nothing, before the initials on their line (A. The first item; - B. The second item). */
const LABEL_HEAD = /^[ \t]*(?:[-*+•][ \t]+)?$/u;

const lineStartOf = (text: string, index: number): number => Math.max(text.lastIndexOf("\n", index - 1), text.lastIndexOf("\r", index - 1)) + 1;

const isFirstOnLine = (text: string, index: number): boolean => LABEL_HEAD.test(text.slice(lineStartOf(text, index), index));

const withoutLastStop = (abbreviation: string): string => `${abbreviation.slice(0, -1)}${PLAIN_LETTER}`;

const joined = (text: string, pattern: RegExp | undefined): string => (pattern === undefined ? text : text.replace(pattern, withoutLastStop));

/** The text with every initial that ends a sentence, and every prepositive or name abbreviation that does not, rewritten. */
export const unmarkInitialStops = (text: string, stops: InitialStops): string => {
  const ended =
    stops.ends === undefined
      ? text
      : text.replace(stops.ends, (initials: string, index: number) => (isFirstOnLine(text, index) ? initials : initials.replace(CAPITAL, PLAIN_LETTER)));
  return joined(joined(ended, stops.joins), stops.names);
};
