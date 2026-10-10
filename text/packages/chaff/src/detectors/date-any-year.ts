// A yearless date that is no date of one year: a day that comes round every year (毎年4月1日, 年末年始（12月29日～1月3日）,
// "each December 31") or a date in a worked example (例えば…4月1日, "e.g. March 31"). There is no year to write. Pure.

/** The words that make a yearless date any year's: a recurring day or a worked example. Their `group` says where they reach. */
export const ANY_YEAR_MARKER_LEXICON = "any-year-marker";

/** The words that join the two ends of a period (から, ～, "to"): 「4月1日から翌年3月31日まで」 is every year's. */
export const YEAR_SPAN_JOINER_LEXICON = "year-span-joiner";

/**
 * Where a marker reaches. `sentence`: earlier in the date's sentence, not closed off by a bracket (例えば…4月1日), or the
 * line a list of dates hangs from ("for example:"). `adjacent`: just before the date ("each December 31"). `label`: before
 * the bracket the date is in (年末年始閉庁日（12月29日～1月3日）).
 */
export type MarkerReach = "sentence" | "adjacent" | "label";

export type AnyYearMarker = { readonly word: string; readonly reach: MarkerReach };

/** The span of a yearless date in the source. */
export type DateSpan = { readonly offset: number; readonly end: number };

/** How far apart the two ends of a period may stand: the joiner and a year word (「から翌年」, " to "). */
const SPAN_GAP_REACH = 12;

/** How many lines above a list item its introducing line is looked for: a longer list is read as no example. */
const LIST_REACH = 64;

/** The end of a sentence: 。, a line break, or a full stop before a capital or a digit ("Mar 3. The", "so. 10 November"). */
const SENTENCE_END = /[。！？\n]|[.!?]["'”’)\]]*\s+(?=[A-Z0-9])/u;
const OPENERS = "(（「『[【〔";
const CLOSERS = ")）」』]】〕";
/** What ends a bracket's label, going back from the bracket: a comma, a full stop, another bracket. */
const LABEL_END = /[、，,。．\n(（「『[【〔)）」』\]】〕]/u;
const LIST_ITEM = /^\s*(?:[-*+・]|\d+[.)．])\s/u;
const LETTER = /\p{L}/u;
const LATIN_START = /^[A-Za-z]/u;
const LATIN_END = /[A-Za-z]$/u;
const COLON_END = /[:：]$/u;

/** Lower case for Latin letters only, so every offset in the text stays where it was ("For example" finds "for example"). */
const latinLower = (text: string): string => text.replace(/[A-Z]/gu, (char) => char.toLowerCase());

const lineStart = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

/** A word of letters ("each") starts a word; 「例えば」 may follow anything. */
const startsWord = (text: string, index: number, word: string): boolean => !LATIN_START.test(word) || index === 0 || !LETTER.test(text.charAt(index - 1));

/** "to" in "today": a word of letters that runs on past its end. */
const runsOn = (text: string, word: string): boolean => LATIN_END.test(word) && LETTER.test(text.charAt(word.length));

const lastWordAt = (text: string, word: string): number => {
  const found = text.lastIndexOf(word);
  if (found === -1 || (startsWord(text, found, word) && !runsOn(text.slice(found), word))) return found;
  return lastWordAt(text.slice(0, found), word);
};

const depthStep = (char: string): number => (OPENERS.includes(char) ? 1 : 0) - (CLOSERS.includes(char) ? 1 : 0);

/** A bracket closes in the text without opening in it: what came before it is cut off from what comes after. */
const closesBracket = (text: string): boolean => [...text].reduce((depth, char) => (depth < 0 ? depth : depth + depthStep(char)), 0) < 0;

/** `dateStart` is the date's first character: a full stop just before "10 November" ends a sentence only by what follows it. */
const inSentence = (before: string, dateStart: string, word: string): boolean => {
  const found = lastWordAt(latinLower(before), word);
  if (found === -1) return false;
  const between = before.slice(found + word.length);
  return !SENTENCE_END.test(`${between}${dateStart}`) && !closesBracket(between);
};

const isAdjacent = (before: string, word: string): boolean => {
  const trimmed = before.trimEnd();
  return trimmed.endsWith(word) && startsWord(trimmed, trimmed.length - word.length, word);
};

/** Where the bracket still open at the end of the text opens. */
const openBracketAt = (text: string): number | undefined =>
  [...text]
    .reduce<number[]>((open, char, index) => {
      const step = depthStep(char);
      if (step > 0) return [...open, index];
      return step < 0 ? open.slice(0, -1) : open;
    }, [])
    .at(-1);

/** The text from the bracket the date is in back to the end of the clause before it: 「年末年始閉庁日」 of 「年末年始閉庁日（12月29日」. */
const labelOf = (before: string): string | undefined => {
  const opener = openBracketAt(before);
  if (opener === undefined) return undefined;
  const head = [...before].slice(0, opener);
  return head.slice(head.findLastIndex((char) => LABEL_END.test(char)) + 1).join("");
};

/** The line a list's run of items hangs from: back over the run and the blank lines before it. */
const introducingLine = (lines: readonly string[]): string | undefined => {
  const above = lines.slice(0, lines.findLastIndex((line) => !LIST_ITEM.test(line)) + 1);
  return above.findLast((line) => line.trim() !== "");
};

/** Where the line `lines` lines above the one at `offset` starts (or the text, if it starts sooner). */
const startLinesBack = (source: string, offset: number, lines: number): number => {
  const previous = source.lastIndexOf("\n", offset - 1);
  return previous === -1 || lines === 0 ? previous + 1 : startLinesBack(source, previous, lines - 1);
};

/** The line a list item's list hangs from ("we use 'to' in date ranges – for example:"), looked for within LIST_REACH lines. */
const introOf = (source: string, before: string, offset: number): string | undefined =>
  LIST_ITEM.test(before) ? introducingLine(source.slice(startLinesBack(source, offset, LIST_REACH), offset).split("\n"))?.trimEnd() : undefined;

/** The line ends with the marker, before or after its colon: 「例：」 and "for example:" alike. */
const introEndsWith = (intro: string, word: string): boolean => isAdjacent(intro, word) || isAdjacent(intro.replace(COLON_END, ""), word);

/** The date is a recurring day or a worked example: a marker stands where its reach covers the date. */
export const anyYearDate = (date: DateSpan, source: string, markers: readonly AnyYearMarker[]): boolean => {
  const before = source.slice(lineStart(source, date.offset), date.offset);
  const intro = introOf(source, before, date.offset);
  return markers.some(({ word: written, reach }) => {
    const word = latinLower(written);
    if (word === "") return false;
    if (reach === "adjacent") return isAdjacent(latinLower(before), word);
    if (reach === "label") return latinLower(labelOf(before) ?? "").includes(word);
    return inSentence(before, source.charAt(date.offset), word) || (intro !== undefined && introEndsWith(latinLower(intro), word));
  });
};

/** The date opens a period whose other end, just after it, follows a joiner (「4月1日から翌年3月31日」). */
export const opensSpan = (date: DateSpan, next: DateSpan | undefined, source: string, joiners: readonly string[]): boolean => {
  if (next === undefined || next.offset - date.end > SPAN_GAP_REACH) return false;
  const gap = source.slice(date.end, next.offset).trimStart();
  return !SENTENCE_END.test(gap) && joiners.some((joiner) => joiner !== "" && gap.startsWith(joiner) && !runsOn(gap, joiner));
};
