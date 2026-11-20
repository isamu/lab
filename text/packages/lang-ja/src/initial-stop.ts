// lang-en/src/initial-stop.ts の写し。アダプタは互いに依存しないので、和文の中の英文に同じ手当てをするために置く。元とのずれは test_mixed_language_stops.ts で比べる。
import { escapeRegExp } from "./regexp.ts";

/**
 * sentence-splitter reads a capital and a full stop as an initial and never ends a sentence there: "Regulation C. The
 * Guide applies" and "Appendix B. In 2020 …" were one sentence. It also ends a sentence after an abbreviation such as
 * "U.S." before any capital, so "the U.S. Census Bureau" was two. Both are decided by the word after the full stop:
 * - capitals with full stops (C., D.C.) before a sentence-start-word (The, In) end the sentence. Their capitals are
 *   replaced with a plain letter, which the splitter does not read as an initial;
 * - a prepositive abbreviation (U.S.) before any other capitalised word does not end it, unless a comma follows that
 *   word ("in the U.S. Yesterday, …"). Its last full stop is replaced with a letter;
 * - an abbreviation that closes a list (etc.) before a sentence-start-word ends the sentence. The splitter joins it to
 *   the next sentence when more than one space or a line break comes between. Its letters are replaced with a plain letter;
 * - capitals with full stops (J., U.K.), or two or three small letters with them (a.m., p.m.), before a word in lower case
 *   ("J. meacham", "Hart, K. and J. Reed", "9 a.m. and 4 p.m.") do not end it, since no sentence opens in lower case. A word that is lower case only at its head (iPhone) may be a name that
 *   opens one, so it is left out. Their last full stop is replaced with a letter.
 * The length does not change, so the spans fit the original text. Initials first on their line are a list's labels
 * (A. The first item) and are left as they are.
 */

export type InitialStops = { readonly ends: RegExp | undefined; readonly joins: RegExp | undefined; readonly closings: RegExp | undefined };

const EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}_.'’])`;
const WORD_END = String.raw`(?![\p{L}\p{N}_.'’-])`;
const PLAIN_LETTER = "n";
const CAPITAL = /\p{Lu}/gu;
const LETTER = /\p{L}/gu;
const BEFORE_LOWER_CASE = new RegExp(String.raw`${EDGE_BEFORE}(?:(?:\p{Lu}\.){1,3}|(?:\p{Ll}\.){2,3})(?=[ \t\r\n]+\p{Ll}(?!\p{Lu}))`, "gu");

const oneOf = (words: readonly string[]): string => `(?:${words.map(escapeRegExp).join("|")})`;

const sentenceStops = (start: string, prepositive: readonly string[]): Pick<InitialStops, "ends" | "joins"> => {
  const ends = new RegExp(String.raw`${EDGE_BEFORE}(?:\p{Lu}\.){1,3}(?=${start})`, "gu");
  if (prepositive.length === 0) return { ends, joins: undefined };
  return { ends, joins: new RegExp(String.raw`${EDGE_BEFORE}${oneOf(prepositive)}(?=\s+\p{Lu})(?!${start})(?!\s+\p{Lu}\p{L}*,)`, "gu") };
};

/** A closing abbreviation (etc.) before a sentence-start word. */
const closingEnds = (start: string, closings: readonly string[]): RegExp | undefined =>
  closings.length === 0 ? undefined : new RegExp(String.raw`${EDGE_BEFORE}${oneOf(closings)}(?=${start})`, "gu");

/** Built once from the lexicons. */
export const initialStops = (startWords: readonly string[], prepositive: readonly string[], closings: readonly string[] = []): InitialStops => {
  if (startWords.length === 0) return { ends: undefined, joins: undefined, closings: undefined };
  const start = String.raw`\s+${oneOf(startWords)}${WORD_END}`;
  return { ...sentenceStops(start, prepositive), closings: closingEnds(start, closings) };
};

/** Only a list's marker, or nothing, before the initials on their line (A. The first item; - B. The second item). */
const LABEL_HEAD = /^[ \t]*(?:[-*+•][ \t]+)?$/u;

const lineStartOf = (text: string, index: number): number => Math.max(text.lastIndexOf("\n", index - 1), text.lastIndexOf("\r", index - 1)) + 1;

const isFirstOnLine = (text: string, index: number): boolean => LABEL_HEAD.test(text.slice(lineStartOf(text, index), index));

const withoutLastStop = (abbreviation: string): string => `${abbreviation.slice(0, -1)}${PLAIN_LETTER}`;

const closed = (text: string, pattern: RegExp | undefined): string =>
  pattern === undefined ? text : text.replace(pattern, (abbreviation: string) => abbreviation.replace(LETTER, PLAIN_LETTER));

/** Initials before a word in lower case, not first on their line (a list's label stays as it is), rewritten. */
const joinedBeforeLowerCase = (text: string): string =>
  text.replace(BEFORE_LOWER_CASE, (initials: string, index: number) => (isFirstOnLine(text, index) ? initials : withoutLastStop(initials)));

/** The text with every initial or closing abbreviation that ends a sentence, and every prepositive abbreviation or initial that does not, rewritten. */
export const unmarkInitialStops = (text: string, stops: InitialStops): string => {
  const ended =
    stops.ends === undefined
      ? text
      : text.replace(stops.ends, (initials: string, index: number) => (isFirstOnLine(text, index) ? initials : initials.replace(CAPITAL, PLAIN_LETTER)));
  const closedText = closed(ended, stops.closings);
  return joinedBeforeLowerCase(stops.joins === undefined ? closedText : closedText.replace(stops.joins, withoutLastStop));
};
