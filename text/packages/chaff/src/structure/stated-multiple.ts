import { escapeRegExp } from "../orthography.ts";

/**
 * The reading shared by the rules that compare an amount stated as a number of another stated amount: a deposit in months
 * of rent (rent-multiple.ts), an annual premium in monthly payments (period-multiple.ts). Words are matched whole, amounts
 * are read as the interval their written digits allow, and a multiple is taken of the nearest stated base. Pure.
 */

/** One amount of money as read: its currency, its value, and the value of the word of scale written in it (万), if any. */
export type StatedAmount = {
  readonly offset: number;
  readonly end: number;
  readonly currency: string;
  readonly value: number;
  readonly scale: number | undefined;
};

/** An amount read as the interval its written digits allow (9.8万円 is anything from 97,500 to 98,500). */
export type Interval = { readonly low: number; readonly high: number };

export type Span = { readonly start: number; readonly end: number };

/** Rounding to the currency's unit (a yen, a dollar) is allowed on top of the written precision. */
const UNIT_SLACK = 1;

const LATIN = /[A-Za-z]/u;
const SEPARATORS = /[\s|｜:：=＝、，,・/／'’()（）[\]［］-]/gu;
const PARENTHETICAL_WITHOUT_DIGITS = /[（(][^()（）0-9０-９]*[)）]/gu;
/** The possessive after a count (2 months' rent, 1 month's rent). */
const POSSESSIVE = /['’]s?(?![A-Za-z])/gu;

const wordPattern = (word: string): string => {
  const edgeStart = LATIN.test(word.charAt(0)) ? "(?<![A-Za-z])" : "";
  const edgeEnd = LATIN.test(word.charAt(word.length - 1)) ? "(?![A-Za-z])" : "";
  return `${edgeStart}${escapeRegExp(word)}${edgeEnd}`;
};

/** One alternation of the words, longest first so 月額賃料 wins over 賃料. Undefined when there are none. */
export const alternation = (words: readonly string[]): string | undefined =>
  words.length === 0
    ? undefined
    : words
        .toSorted((left, right) => right.length - left.length)
        .map(wordPattern)
        .join("|");

export const occurrences = (text: string, words: readonly string[]): Span[] => {
  const pattern = alternation(words);
  if (pattern === undefined) return [];
  return [...text.matchAll(new RegExp(pattern, "giu"))].map((match) => ({ start: match.index, end: match.index + match[0].length }));
};

const withoutWords = (text: string, words: readonly string[]): string => {
  const pattern = alternation(words);
  return pattern === undefined ? text : text.replace(new RegExp(pattern, "giu"), "");
};

/** Whether only separators, bracketed words and link words stand in the gap (「 | 」, " (monthly): ", "の", "'s rent ("). */
export const isPlainGap = (gap: string, words: readonly string[]): boolean =>
  withoutWords(gap.replace(PARENTHETICAL_WITHOUT_DIGITS, "").replace(POSSESSIVE, ""), words).replace(SEPARATORS, "") === "";

const decimalsOf = (written: string): number => /[.．]([0-9０-９]+)/u.exec(written)?.[1]?.length ?? 0;

/** The interval an amount's digits allow: a word of scale (9.8万) leaves half its last digit either way; plain digits are exact. */
export const intervalOf = (amount: StatedAmount, written: string): Interval => {
  const half = amount.scale === undefined ? 0 : (amount.scale * 10 ** -decimalsOf(written)) / 2;
  return { low: amount.value - half, high: amount.value + half };
};

/** Whether the amount is the count of one of the bases, within the written precision and a unit's rounding. */
export const isMultiple = (count: number, amount: Interval, bases: readonly Interval[]): boolean =>
  bases.some((base) => count * base.low - UNIT_SLACK <= amount.high && amount.low <= count * base.high + UNIT_SLACK);

type Stated = { readonly offset: number; readonly range: Interval | undefined };

/** The base a statement at this offset is of: the nearest before it, or, before any, the one base the document states. */
export const nearestStated = <T extends Stated>(bases: readonly T[], offset: number): T | undefined => {
  const before = bases.filter((base) => base.offset < offset).at(-1);
  if (before !== undefined) return before;
  const [first] = bases;
  return bases.every((base) => base.range !== undefined && base.range.low === first?.range?.low && base.range.high === first.range.high) ? first : undefined;
};
