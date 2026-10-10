// Which currency an amount is written in, read from the marks of lexicon currency-notation: before the number ($1,320,
// JPY 1,320) or after it (1,320 yen, 1,320 million dollars, 1,320 USD). The tree's quantity is the number alone; a word of
// magnitude stays outside it, as it does for "$12 million".

import { startsWithUnit } from "./unit-case.ts";

export type CurrencyMarks = {
  readonly before: readonly string[];
  readonly after: readonly string[];
  /** Words of magnitude that may stand between the number and a mark after it ("million" in "1,320 million yen"). */
  readonly multipliers: readonly string[];
};

const LATIN = /[A-Za-z]/u;
const WORD_CHAR = /[\p{L}\p{N}_]/u;
/** A year written alone. "in 2020 dollars" is a year's money, not an amount of 2,020. */
const YEAR = /^(?:1[89]|2[01])\d{2}$/u;

const isGap = (char: string | undefined): boolean => char === " " || char === "\t";

/** A Latin mark is a whole word: "XUSD 5" is not USD, "1,320 USDT" is not USD. */
const standsAlone = (mark: string, before: string, after: string): boolean => !LATIN.test(mark) || (!WORD_CHAR.test(before) && !WORD_CHAR.test(after));

/** The mark that touches the number, allowing one space: "US$1,320" is read with "$", as it always was. */
export const currencyBefore = (text: string, at: number, marks: CurrencyMarks): string | undefined => {
  const end = isGap(text[at - 1]) ? at - 1 : at;
  return marks.before
    .filter((mark) => text.startsWith(mark, end - mark.length) && standsAlone(mark, text.charAt(end - mark.length - 1), ""))
    .toSorted((left, right) => left.length - right.length)[0];
};

const MULTIPLIER_WORD = /^[ \t]([A-Za-z]+)(?=[ \t])/u;

/** "1,320 million yen": the space and the word of magnitude before the mark, or nothing. */
const multiplierLength = (rest: string, multipliers: readonly string[]): number => {
  const word = MULTIPLIER_WORD.exec(rest)?.[1] ?? "";
  return multipliers.includes(word.toLowerCase()) ? word.length + 1 : 0;
};

/**
 * The mark after the number: "1,320 yen", "1,320 million dollars", "1,320USD". A year before it ("2020 dollars") is not an
 * amount, nor is the second half of a time or a ratio (the 30 of "10:30").
 */
export const currencyAfter = (text: string, start: number, end: number, marks: CurrencyMarks): string | undefined => {
  const scaled = multiplierLength(text.slice(end), marks.multipliers);
  const from = end + scaled + (isGap(text[end + scaled]) ? 1 : 0);
  if (text[start - 1] === ":" || (from > end && scaled === 0 && YEAR.test(text.slice(start, end)))) return undefined;
  return marks.after
    .filter((mark) => startsWithUnit(text, from, mark) && standsAlone(mark, "", text.charAt(from + mark.length)))
    .toSorted((left, right) => right.length - left.length)[0];
};
