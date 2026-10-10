// amount-range-reversed and quantity-range-reversed: a range whose upper end is below its lower end (月給30万円〜25万円,
// $90,000–$70,000, 下限30万円・上限25万円, 5–2 kg, -10〜-40℃). The ends come read (currency or unit, value, the word of scale
// they carry); the words that join a range, change a value, and label a bound come from the lexicons. Pure.
import { escapeRegExp } from "../orthography.ts";
import { amountValue, type ScaleWord } from "./amount-scale.ts";
import type { StructureIssue } from "./issues.ts";

/** One amount written with its currency (or a quantity with its unit, in currency). scale is the value of the word of scale written in it (万, million), if any. */
export type RangeAmount = {
  readonly offset: number;
  readonly end: number;
  readonly currency: string;
  readonly value: number;
  readonly scale: number | undefined;
  readonly position: "before" | "after";
};

export type AmountRangeWords = {
  /** The marks and words that make a range on their own (〜, –, to). */
  readonly connectors: readonly string[];
  /** Words that make a range only when a closer follows the second amount (から … まで). */
  readonly openers: readonly string[];
  readonly closers: readonly string[];
  /** Words that, in the same sentence, make a descending pair a change of price and not a range (値下げ, reduced). */
  readonly changes: readonly string[];
  /** Labels of the lower and upper bound (下限, min; 上限, max) and the particles that may follow a label (は, of). */
  readonly lowers: readonly string[];
  readonly uppers: readonly string[];
  readonly links: readonly string[];
  /** The words of scale (万, million, k) and the digits of a number (the reader's pattern; a quantity's may open with a minus sign). */
  readonly scales: readonly ScaleWord[];
  readonly number: string;
};

/** An end that took its word of scale from the other end (30〜25万円) is believed reversed only this close to the other. */
const MAX_INHERITED_RATIO = 10;

const SEPARATORS = /[\s・、，,;；/／|｜:：=＝()（）「」.．]/gu;

const LATIN = /^[A-Za-z]/u;

/** A Latin word is matched at word edges (cut does not match cutting); other scripts as written. */
const wordPattern = (word: string): string => {
  const escaped = escapeRegExp(word.toLowerCase());
  return LATIN.test(word) ? `(?<![a-z])${escaped}(?![a-z])` : escaped;
};

const hasWord = (text: string, words: readonly string[]): boolean => words.some((word) => new RegExp(wordPattern(word), "u").test(text.toLowerCase()));

const isOneOf = (text: string, words: readonly string[]): boolean => words.some((word) => word.toLowerCase() === text.toLowerCase());

const lineBounds = (text: string, offset: number): { readonly start: number; readonly end: number } => {
  const end = text.indexOf("\n", offset);
  return { start: text.lastIndexOf("\n", offset - 1) + 1, end: end === -1 ? text.length : end };
};

/** A sentence ends at 。, or at a full stop followed by a capital or the line end (e.g. does not end one). */
const SENTENCE_END = /[。！？]|[.!?](?=\s+[A-Z]|\s*$)/gu;

/** The sentence holding the range, within its line. */
const sentenceAround = (text: string, start: number, end: number): string => {
  const line = lineBounds(text, start);
  const ends = [...text.slice(line.start, line.end).matchAll(SENTENCE_END)].map((match) => line.start + match.index);
  const from = ends.filter((at) => at < start).at(-1) ?? line.start;
  const to = ends.find((at) => at >= end) ?? line.end;
  return text.slice(from, to);
};

/** What follows the second amount, on its line, without leading spaces. */
const restOfLine = (text: string, end: number): string => text.slice(end, lineBounds(text, end).end).trimStart();

const ARITHMETIC = /[=＝]/u;

/** Whether the joint between two ends makes them a range: a connector, or an opener with a closer after the second end. */
const joinsRange = (joint: string, after: string, words: AmountRangeWords): boolean => {
  if (joint.includes("\n")) return false;
  const bare = joint.trim();
  return isOneOf(bare, words.connectors) || (isOneOf(bare, words.openers) && words.closers.some((closer) => after.startsWith(closer)));
};

type End = { readonly offset: number; readonly end: number; readonly value: number; readonly inherited: boolean };

type Pair = readonly [End, End];

const pairOf = (low: End, high: End): Pair => [low, high];

/** A number as written, with the value of its word of scale (undefined when it has none). */
type Reading = { readonly offset: number; readonly end: number; readonly value: number; readonly scale: number | undefined };

const scaleOf = (word: string | undefined, words: AmountRangeWords): number | undefined =>
  word === undefined ? undefined : words.scales.find((scale) => scale.word.toLowerCase() === word.toLowerCase())?.value;

const alternation = (patterns: readonly string[]): string => patterns.toSorted((left, right) => right.length - left.length).join("|");

const scalePart = (words: AmountRangeWords): string => {
  const scales = alternation(words.scales.map((scale) => escapeRegExp(scale.word)));
  // With no words of scale the group still stands, never matching, so the joint keeps its group number.
  return scales === "" ? "((?!))?" : `(?:\\s?(${scales}))?`;
};

const jointPart = (words: AmountRangeWords): string => `(\\s?(?:${alternation([...words.connectors, ...words.openers].map(wordPattern))})\\s?)`;

const MINUS = /^[-−－]/u;

/** The value of a bare number, negative when it opens with a minus sign (-10〜-40℃). */
const signedValue = (digits: string): number | undefined => {
  const value = amountValue(digits.replace(MINUS, ""), []);
  return value === undefined || !MINUS.test(digits) ? value : -value;
};

/** A bare number (no currency) and its word of scale, if any. */
const bareReading = (
  span: { readonly offset: number; readonly end: number },
  digits: string,
  scaleWord: string | undefined,
  words: AmountRangeWords,
): Reading | undefined => {
  const value = signedValue(digits);
  if (value === undefined) return undefined;
  const scale = scaleOf(scaleWord, words);
  return { ...span, value: scale === undefined ? value : value * scale, scale };
};

/** One end of a range written with the word of scale only once: the end without one reads it from the other (30〜25万円, $90–70k). */
const sharing = (own: Reading, other: Reading): End =>
  own.scale === undefined && other.scale !== undefined
    ? { offset: own.offset, end: own.end, value: own.value * other.scale, inherited: true }
    : { offset: own.offset, end: own.end, value: own.value, inherited: false };

const sharedPair = (first: Reading, second: Reading): Pair => pairOf(sharing(first, second), sharing(second, first));

/** The bare number right before a currency-after amount, joined to it (30〜 before 25万円), sharing its currency. */
const sharedBefore = (text: string, amount: RangeAmount, floor: number, words: AmountRangeWords): Pair | undefined => {
  const pattern = new RegExp(`(?<![0-9０-９.,，A-Za-z])(${words.number})${scalePart(words)}${jointPart(words)}$`, "iu");
  const match = pattern.exec(text.slice(floor, amount.offset));
  if (match === null || !joinsRange(match[3] ?? "", restOfLine(text, amount.end), words)) return undefined;
  const offset = floor + match.index;
  const bare = bareReading({ offset, end: offset + match[0].length - (match[3] ?? "").length }, match[1] ?? "", match[2], words);
  return bare === undefined ? undefined : sharedPair(bare, amount);
};

/** The bare number right after a currency-before amount, joined to it ($90–70k), sharing its currency. */
const sharedAfter = (text: string, amount: RangeAmount, ceiling: number, words: AmountRangeWords): Pair | undefined => {
  const pattern = new RegExp(`^${jointPart(words)}(${words.number})${scalePart(words)}(?![0-9０-９A-Za-z])`, "iu");
  const match = pattern.exec(text.slice(amount.end, ceiling));
  if (match === null || !joinsRange(match[1] ?? "", restOfLine(text, amount.end + match[0].length), words)) return undefined;
  const bare = bareReading({ offset: amount.end + (match[1] ?? "").length, end: amount.end + match[0].length }, match[2] ?? "", match[3], words);
  return bare === undefined ? undefined : sharedPair(amount, bare);
};

const asEnd = (amount: RangeAmount): End => ({ offset: amount.offset, end: amount.end, value: amount.value, inherited: false });

/** Both ends written with their currency, joined by a connector. */
const writtenPair = (text: string, first: RangeAmount, second: RangeAmount, words: AmountRangeWords): Pair | undefined => {
  if (first.currency !== second.currency) return undefined;
  if (!joinsRange(text.slice(first.end, second.offset), restOfLine(text, second.end), words)) return undefined;
  return pairOf(asEnd(first), asEnd(second));
};

const isReversed = ([low, high]: Pair): boolean => {
  if (low.value <= high.value) return false;
  return !(low.inherited || high.inherited) || low.value / high.value <= MAX_INHERITED_RATIO;
};

/** A pair is a range in a sentence that changes no price and holds no equation (5,000円-2,000円=3,000円). */
const readsAsRange = (text: string, [low, high]: Pair, words: AmountRangeWords): boolean => {
  const start = Math.min(low.offset, high.offset);
  const end = Math.max(low.end, high.end);
  const sentence = sentenceAround(text, start, end);
  return !ARITHMETIC.test(sentence) && !hasWord(sentence, words.changes);
};

/** The pairs of ends read as ranges: two written amounts, or one written amount and a bare number sharing its currency. */
const pairsOf = (text: string, amounts: readonly RangeAmount[], words: AmountRangeWords): Pair[] =>
  amounts.flatMap((amount, index) => {
    const previous = amounts[index - 1];
    const next = amounts[index + 1];
    const floor = Math.max(previous?.end ?? 0, lineBounds(text, amount.offset).start);
    return [
      previous === undefined ? undefined : writtenPair(text, previous, amount, words),
      amount.position === "after" ? sharedBefore(text, amount, floor, words) : undefined,
      amount.position === "before" ? sharedAfter(text, amount, next?.offset ?? text.length, words) : undefined,
    ].filter((pair) => pair !== undefined);
  });

/** Whether the text is only separators, particles, and at most the given label. */
const onlyLabel = (text: string, labels: readonly string[], words: AmountRangeWords): boolean => {
  const rest = words.links.reduce((left, link) => left.replace(new RegExp(wordPattern(link), "giu"), " "), text.toLowerCase()).replace(SEPARATORS, "");
  return rest === "" || isOneOf(rest, labels);
};

/** The label written right before the amount, past separators and particles: lower, upper, or none. */
const labelBefore = (text: string, amount: RangeAmount, floor: number, words: AmountRangeWords): "lower" | "upper" | undefined => {
  const before = text.slice(floor, amount.offset).toLowerCase();
  const ends = (labels: readonly string[]): boolean =>
    labels.some((label) => {
      const match = new RegExp(`^[^]*${wordPattern(label)}([^]*)$`, "u").exec(before);
      return match !== null && onlyLabel(match[1] ?? "", [], words);
    });
  if (ends(words.lowers)) return "lower";
  return ends(words.uppers) ? "upper" : undefined;
};

/** Two adjacent amounts on one line labelled lower and upper bound (下限30万円・上限25万円), in either order. */
const labelledPairs = (text: string, amounts: readonly RangeAmount[], words: AmountRangeWords): Pair[] =>
  amounts.slice(1).flatMap((second, index) => {
    const first = amounts[index];
    if (first === undefined || first.currency !== second.currency || text.slice(first.end, second.offset).includes("\n")) return [];
    const floor = Math.max(amounts[index - 1]?.end ?? 0, lineBounds(text, first.offset).start);
    const firstLabel = labelBefore(text, first, floor, words);
    const secondLabel = labelBefore(text, second, first.end, words);
    if (firstLabel === undefined || secondLabel === undefined || firstLabel === secondLabel) return [];
    if (!onlyLabel(text.slice(first.end, second.offset), [...words.lowers, ...words.uppers], words)) return [];
    return [firstLabel === "lower" ? pairOf(asEnd(first), asEnd(second)) : pairOf(asEnd(second), asEnd(first))];
  });

const issueOf = (text: string, [low, high]: Pair): StructureIssue => {
  const start = Math.min(low.offset, high.offset);
  return { offset: start, values: { range: text.slice(start, Math.max(low.end, high.end)).trim() } };
};

/** The ranges of amounts, written or labelled, whose upper end is below the lower one, once per place, in document order. */
export const reversedAmountRanges = (text: string, amounts: readonly RangeAmount[], words: AmountRangeWords): StructureIssue[] =>
  [...pairsOf(text, amounts, words), ...labelledPairs(text, amounts, words)]
    .filter((pair) => isReversed(pair) && readsAsRange(text, pair, words))
    .map((pair) => issueOf(text, pair))
    .toSorted((left, right) => left.offset - right.offset)
    .filter((issue, index, issues) => issues[index - 1]?.offset !== issue.offset);
