// A yearless date that is no date of one year: a day that comes round every year (毎年4月1日, 年末年始（12月29日～1月3日）,
// "each December 31") or a date in a worked example (例えば…4月1日, "e.g. March 31"). There is no year to write. Pure.

/** The words that make a yearless date any year's: a recurring day or a worked example. Their `group` says where they reach. */
export const ANY_YEAR_MARKER_LEXICON = "any-year-marker";

/** The words that join the two ends of a period (から, ～, "to"): 「4月1日から翌年3月31日まで」 is every year's. */
export const YEAR_SPAN_JOINER_LEXICON = "year-span-joiner";

/**
 * Where a marker reaches. `sentence`: earlier in the date's sentence, not closed off by a bracket (例えば…4月1日), or the
 * line a list of dates hangs from ("for example:"). `example`: as `sentence`, and on to the end of the list item it is in.
 * `adjacent`: just before the date ("each December 31"). `near`: ending a few characters before it (決算日は、12月31日).
 * `label`: before the bracket the date is in (年末年始閉庁日（12月29日～1月3日）). `continues`: opening a list item just
 * after an example's item, it carries the example on ("- For example, … June 22." then "- If instead … June 25").
 * `listed`: named in one list with the date, only list joiners between (祝休日及び12月29日, "public holidays and December 24").
 */
export type MarkerReach = "sentence" | "example" | "adjacent" | "near" | "label" | "continues" | "listed";

export const MARKER_REACHES: readonly MarkerReach[] = ["sentence", "example", "adjacent", "near", "label", "continues", "listed"];

export type AnyYearMarker = { readonly word: string; readonly reach: MarkerReach };

/** The span of a yearless date in the source. */
export type DateSpan = { readonly offset: number; readonly end: number };

/** How far apart the two ends of a period may stand: the joiner and a year word (「から翌年」, " to "). */
const SPAN_GAP_REACH = 12;

/** How many lines above a list item its introducing line is looked for: a longer list is read as no example. */
const LIST_REACH = 64;

/** How many characters a `near` marker may end before the date: 「は、」 of 「決算日は、」, " is " of "fiscal year end is". */
const NEAR_REACH = 4;

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

const wordsOf = (markers: readonly AnyYearMarker[], reach: MarkerReach): string[] =>
  markers.flatMap((marker) => (marker.reach === reach && marker.word !== "" ? [latinLower(marker.word)] : []));

/** A list item's text after its bullet: "If instead …" of "    - If instead …". */
const itemText = (line: string): string => line.replace(LIST_ITEM, "");

const indentOf = (line: string): number => line.length - line.trimStart().length;

/** The line just above the one at `offset`, when it is a list item at the same depth (no blank line between). */
const itemAbove = (source: string, offset: number): string | undefined => {
  const start = lineStart(source, offset);
  if (start === 0) return undefined;
  const above = source.slice(lineStart(source, start - 1), start - 1);
  return LIST_ITEM.test(above) && indentOf(above) === indentOf(source.slice(start, offset)) ? above : undefined;
};

const opensWith = (text: string, word: string): boolean => text.startsWith(word) && !runsOn(text, word);

const opensWithAny = (line: string, words: readonly string[]): boolean => words.some((word) => opensWith(latinLower(itemText(line)), word));

/** `item` holds an example, or carries one on from the item above it; `steps` bounds how far up the chain is followed. */
const exampleItem = (source: string, item: string, itemEnd: number, markers: readonly AnyYearMarker[], steps: number): boolean => {
  if (wordsOf(markers, "example").some((word) => lastWordAt(latinLower(item), word) !== -1)) return true;
  if (steps === 0 || !opensWithAny(item, wordsOf(markers, "continues"))) return false;
  const above = itemAbove(source, itemEnd);
  return above !== undefined && exampleItem(source, above, lineStart(source, itemEnd) - 1, markers, steps - 1);
};

/** The date's list item opens with a word that carries on the example in the list item just above it. */
const continuesExample = (date: DateSpan, before: string, source: string, markers: readonly AnyYearMarker[]): boolean => {
  if (!LIST_ITEM.test(before) || !opensWithAny(before, wordsOf(markers, "continues"))) return false;
  const above = itemAbove(source, date.offset);
  return above !== undefined && exampleItem(source, above, lineStart(source, date.offset) - 1, markers, LIST_REACH);
};

/** What is left of `gap` once the list joiners at its head and the spaces around them are taken off. */
const afterJoiners = (gap: string, joiners: readonly string[]): string => {
  const trimmed = gap.trimStart();
  const joiner = joiners.find((candidate) => candidate !== "" && trimmed.startsWith(candidate) && !runsOn(trimmed, candidate));
  return joiner === undefined ? trimmed : afterJoiners(trimmed.slice(joiner.length), joiners);
};

/** The word stands just before the date with only list joiners between: 「祝休日及び」, "holidays, and ". */
const listedBefore = (before: string, word: string, joiners: readonly string[]): boolean => {
  const found = lastWordAt(before, word);
  if (found === -1) return false;
  const gap = before.slice(found + word.length);
  return gap.trim() !== "" && afterJoiners(gap, joiners) === "";
};

const coversDate = (before: string, dateStart: string, intro: string | undefined, word: string, reach: MarkerReach, joiners: readonly string[]): boolean => {
  if (reach === "adjacent") return isAdjacent(latinLower(before), word);
  if (reach === "listed") return listedBefore(latinLower(before), word, joiners);
  if (reach === "near") return lastWordAt(latinLower(before.slice(-(word.length + NEAR_REACH))), word) !== -1;
  if (reach === "label") return latinLower(labelOf(before) ?? "").includes(word);
  if (reach === "continues") return false;
  const inItem = reach === "example" && LIST_ITEM.test(before) && lastWordAt(latinLower(before), word) !== -1;
  return inItem || inSentence(before, dateStart, word) || (intro !== undefined && introEndsWith(latinLower(intro), word));
};

/**
 * The date is a recurring day or a worked example: a marker stands where its reach covers the date. `listJoiners` are the
 * words a `listed` marker may stand before the date with (及び, "and").
 */
export const anyYearDate = (date: DateSpan, source: string, markers: readonly AnyYearMarker[], listJoiners: readonly string[] = []): boolean => {
  const before = source.slice(lineStart(source, date.offset), date.offset);
  const intro = introOf(source, before, date.offset);
  const joiners = listJoiners.map(latinLower);
  const covered = markers.some(({ word, reach }) => word !== "" && coversDate(before, source.charAt(date.offset), intro, latinLower(word), reach, joiners));
  return covered || continuesExample(date, before, source, markers);
};

/** The date opens a period whose other end, just after it, follows a joiner (「4月1日から翌年3月31日」). */
export const opensSpan = (date: DateSpan, next: DateSpan | undefined, source: string, joiners: readonly string[]): boolean => {
  if (next === undefined || next.offset - date.end > SPAN_GAP_REACH) return false;
  const gap = source.slice(date.end, next.offset).trimStart();
  return !SENTENCE_END.test(gap) && joiners.some((joiner) => joiner !== "" && gap.startsWith(joiner) && !runsOn(gap, joiner));
};
