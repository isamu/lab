// number-word-figure-mismatch: the reading half. A number written in words and then in figures in brackets ("six (7)
// months", 「金参拾万円（30,000円）」) is read on both sides; the words come from the lexicon number-word, the marks that may
// stand around the figure from currency-notation and amount-multiplier.

export type NumberWordKind = "digit" | "place" | "scale" | "joiner" | "lead" | "unit";

export type NumberWord = { readonly word: string; readonly kind: NumberWordKind; readonly value: number };

/** What the scan needs: the number words, the marks that may stand before or after the figure, and the words of scale. */
export type NumberVocabulary = {
  readonly words: readonly NumberWord[];
  readonly marksBefore: readonly string[];
  readonly marksAfter: readonly string[];
  readonly multipliers: readonly { readonly word: string; readonly value: number }[];
};

export type WordFigureSlip = { readonly offset: number; readonly end: number; readonly written: string; readonly words: number; readonly figure: number };

type Reading = {
  readonly done: number;
  readonly total: number;
  readonly current: number;
  readonly hasCurrent: boolean;
  readonly lastPlace: number;
  readonly lastScale: number;
};

const START: Reading = { done: 0, total: 0, current: 0, hasCurrent: false, lastPlace: Infinity, lastScale: Infinity };
const TENS_MIN = 20;
const TENS_MAX = 90;
const TEN = 10;

/** "twenty" then "one" is 21; any other digit after a digit ("five five", 二〇) is not one number. */
const joinsDigit = (reading: Reading, value: number): boolean =>
  !reading.hasCurrent || (reading.current >= TENS_MIN && reading.current <= TENS_MAX && reading.current % TEN === 0 && value > 0 && value < TEN);

const stepWord = (reading: Reading | undefined, word: NumberWord): Reading | undefined => {
  if (reading === undefined) return undefined;
  if (word.kind === "digit") return joinsDigit(reading, word.value) ? { ...reading, current: reading.current + word.value, hasCurrent: true } : undefined;
  if (word.kind === "place") {
    if (word.value >= reading.lastPlace) return undefined;
    return { ...reading, total: reading.total + (reading.hasCurrent ? reading.current : 1) * word.value, current: 0, hasCurrent: false, lastPlace: word.value };
  }
  const group = reading.total + reading.current;
  if (word.kind !== "scale" || word.value >= reading.lastScale || (group === 0 && !reading.hasCurrent)) return undefined;
  return { ...START, done: reading.done + group * word.value, lastScale: word.value };
};

const CLOSES_GROUP: ReadonlySet<NumberWordKind> = new Set(["place", "scale"]);

/** Whether each joiner ("and") stands after a place or scale and before a digit: one hundred and five, not one and hundred. */
const joinersInside = (words: readonly NumberWord[]): boolean =>
  words.every((word, index) => word.kind !== "joiner" || (CLOSES_GROUP.has(words[index - 1]?.kind ?? "joiner") && words[index + 1]?.kind === "digit"));

/**
 * The value of a number written in words, read left to right: digits add, a place multiplies the digits before it (five
 * hundred, 三千), a scale multiplies everything before it (fifty thousand, 参拾万). undefined when the words are not one
 * well-formed number: empty, starting with a scale, a digit after a digit, places or scales out of order.
 */
export const numberOfWords = (words: readonly NumberWord[]): number | undefined => {
  if (words.length === 0 || words[0]?.kind === "scale" || !joinersInside(words)) return undefined;
  const reading = words.filter((word) => word.kind !== "joiner").reduce<Reading | undefined>(stepWord, START);
  return reading === undefined ? undefined : reading.done + reading.total + reading.current;
};

const FULLWIDTH_ZERO = 0xff10;
const halfWidth = (text: string): string =>
  text
    .replace(/[０-９]/gu, (char) => String(char.charCodeAt(0) - FULLWIDTH_ZERO))
    .replace(/．/gu, ".")
    .replace(/，/gu, ",");

const FIGURE = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/u;

/** The longest of the words the text starts with, compared without regard to case. */
const leadingWord = (text: string, words: readonly string[]): string =>
  words
    .filter((word) => word !== "" && text.toLowerCase().startsWith(word.toLowerCase()))
    .reduce((longest, word) => (word.length > longest.length ? word : longest), "");

/**
 * The value of a figure in brackets: digits with separators, a currency mark before ($5,000) or after (300,000円), a word of
 * scale ($5 million), a unit after (5%). undefined when the bracket holds anything else (Section 6, a name, a date).
 */
export const figureValue = (content: string, vocabulary: NumberVocabulary): number | undefined => {
  const trimmed = halfWidth(content).trim();
  const afterMark = trimmed.slice(leadingWord(trimmed, vocabulary.marksBefore).length).trimStart();
  const figure = FIGURE.exec(afterMark)?.[0];
  if (figure === undefined) return undefined;
  const rest = afterMark.slice(figure.length).trimStart();
  const multiplier = leadingWord(
    rest,
    vocabulary.multipliers.map((entry) => entry.word),
  );
  const tail = rest.slice(multiplier.length).trimStart();
  if (tail.slice(leadingWord(tail, vocabulary.marksAfter).length).trim() !== "") return undefined;
  const scale = vocabulary.multipliers.find((entry) => entry.word === multiplier)?.value ?? 1;
  return Number(figure.replace(/,/gu, "")) * scale;
};

const BRACKET = /[(（]([^()（）\n]{1,40})[)）]/gu;
const SEPARATOR = " \t-";
const SPACE = " \t";
/** How far back spaces are skipped, and how many words one number in words may have (one million two hundred and five is six). */
const SKIP_REACH = 40;
const MAX_RUN_WORDS = 16;
const RUN_KINDS: ReadonlySet<NumberWordKind> = new Set(["digit", "place", "scale", "joiner"]);
const SCRIPTS = [/\p{Script=Han}/u, /\p{Script=Latin}/u, /\p{Script=Hiragana}/u, /\p{Script=Katakana}/u, /\p{Script=Cyrillic}/u, /\p{Script=Greek}/u];

/** Whether two letters are of one script: 統 before 一 makes one word (統一), は before 三 does not. */
const sameScript = (a: string, b: string): boolean => SCRIPTS.some((script) => script.test(a) && script.test(b));

/** The longest of the words the text ends with at `end`, compared without regard to case. */
const endingWord = <T extends { readonly word: string }>(text: string, end: number, words: readonly T[]): T | undefined =>
  words
    .filter((entry) => entry.word !== "" && text.slice(Math.max(0, end - entry.word.length), end).toLowerCase() === entry.word.toLowerCase())
    .reduce<T | undefined>((longest, entry) => (longest === undefined || entry.word.length > longest.word.length ? entry : longest), undefined);

/** Where the run of `chars` (spaces, hyphens) that ends at `end` starts, looking back no further than SKIP_REACH. */
const skipBack = (text: string, end: number, chars: string): number => {
  const window = text.slice(Math.max(0, end - SKIP_REACH), end).split("");
  const lastOther = window.findLastIndex((char) => !chars.includes(char));
  return end - (window.length - (lastOther + 1));
};

type Placed = { readonly word: NumberWord; readonly start: number };

/**
 * The number words that end at `end`, read backwards: the first right at `end`, the others past spaces or hyphens. A run
 * longer than any number in words is not one number, and gives none.
 */
const placedBefore = (text: string, end: number, words: readonly NumberWord[], found: readonly Placed[] = []): readonly Placed[] => {
  const from = found.length === 0 ? end : skipBack(text, end, SEPARATOR);
  const word = endingWord(text, from, words);
  if (word === undefined) return found;
  if (found.length >= MAX_RUN_WORDS) return [];
  const start = from - word.word.length;
  return placedBefore(text, start, words, [{ word, start }, ...found]);
};

/** The run of number words before `end`, without the joiners it starts with ("and one" is "one"). */
const runBefore = (text: string, end: number, words: readonly NumberWord[]): readonly Placed[] => {
  const placed = placedBefore(text, end, words);
  const first = placed.findIndex((entry) => entry.word.kind !== "joiner");
  return first < 0 ? [] : placed.slice(first);
};

/** Numerals written one character to a word and two or more in a row (契約期間十二) are a number even right after a word. */
const isSolidNumeral = (run: readonly Placed[]): boolean => run.length > 1 && run[0]?.word.word.length === 1;

/**
 * Whether the run is a number of its own: the letter before it is of another script, it is a solid numeral, or a lead stands
 * before it (金参, 年五). A single numeral after a word of its script is part of that word (統一, 唯一, often).
 */
const startsWord = (text: string, run: readonly Placed[], vocabulary: NumberVocabulary): boolean => {
  const start = run[0]?.start ?? 0;
  const before = text.charAt(start - 1);
  const leads = vocabulary.words.filter((word) => word.kind === "lead");
  return before === "" || !sameScript(before, text.charAt(start)) || isSolidNumeral(run) || endingWord(text, start, leads) !== undefined;
};

const YEAR = /^\s*[12]\d{3}\s*$/u;
const YEAR_WORDS_BELOW = 1000;

/** A bare four-digit figure after a small number in words is a year in brackets ("two (2026)"), not the same number again. */
const isYear = (content: string, words: number): boolean => YEAR.test(halfWidth(content)) && words < YEAR_WORDS_BELOW;

/** Where the words before a bracket end: past the spaces and one unit or currency word ("Dollars", 円, percent). */
const wordsEnd = (text: string, bracket: number, vocabulary: NumberVocabulary): number => {
  const spaced = skipBack(text, bracket, SPACE);
  const unit = endingWord(
    text,
    spaced,
    vocabulary.marksAfter.map((word) => ({ word })),
  );
  return unit === undefined ? spaced : skipBack(text, spaced - unit.word.length, SPACE);
};

const RELATIVE_TOLERANCE = 1e-9;
const differ = (a: number, b: number): boolean => Math.abs(a - b) > RELATIVE_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));

const slipAt = (text: string, match: RegExpExecArray, vocabulary: NumberVocabulary, runWords: readonly NumberWord[]): WordFigureSlip | undefined => {
  const content = match[1] ?? "";
  const run = runBefore(text, wordsEnd(text, match.index, vocabulary), runWords);
  const start = run[0]?.start;
  if (start === undefined || !startsWord(text, run, vocabulary)) return undefined;
  const words = numberOfWords(run.map((entry) => entry.word));
  const figure = figureValue(content, vocabulary);
  if (words === undefined || figure === undefined || !differ(words, figure) || isYear(content, words)) return undefined;
  const end = match.index + match[0].length;
  return { offset: start, end, written: text.slice(start, end), words, figure };
};

/** Every number written in words whose figure in brackets right after it says another number. */
export const wordFigureSlips = (text: string, vocabulary: NumberVocabulary): WordFigureSlip[] => {
  const runWords = vocabulary.words.filter((word) => RUN_KINDS.has(word.kind));
  if (runWords.length === 0) return [];
  return [...text.matchAll(BRACKET)].flatMap((match) => slipAt(text, match, vocabulary, runWords) ?? []);
};
