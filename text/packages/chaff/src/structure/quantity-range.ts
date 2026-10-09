// quantity-range-reversed: which measured quantities may be one end of a range, read as the ends structure/amount-range.ts
// compares. Pure.
import type { Measured } from "../facts/measures.ts";
import type { RangeAmount } from "./amount-range.ts";

const LATIN_EDGE = /[A-Za-z]$/u;
const LATIN_START = /^[A-Za-z]/u;

/** A Latin unit running into a word is part of that word: the t of "40 to" is not a tonne. */
const standsAlone = (text: string, measured: Measured): boolean =>
  !(LATIN_EDGE.test(measured.unit) && LATIN_START.test(text.slice(measured.end, measured.end + 1)));

/** 10 and a minus sign right before the number is a power of ten written flat ("10-8 cm" for 10⁻⁸ cm), not a range. */
const POWER_OF_TEN = /(?<![0-9０-９.,，．])[1１][0０][-−－]$/u;

/** "10-" and the character before it, which must not be a digit (110-8 cm is a range). */
const POWER_OF_TEN_LOOKBACK = 4;

const isExponent = (text: string, measured: Measured): boolean =>
  POWER_OF_TEN.test(text.slice(Math.max(0, measured.start - POWER_OF_TEN_LOOKBACK), measured.start));

/** A quantity as one end of a range: two ends compare only in one unit, however it is spelled (℃ with °C, m with meters). */
const rangeEndOf = (text: string, measured: Measured): RangeAmount => ({
  offset: measured.start,
  end: measured.end,
  currency: `${measured.dimension}:${measured.factors.join(",")}`,
  value: measured.amount,
  scale: undefined,
  position: text.startsWith(measured.unit, measured.start) ? "before" : "after",
});

/** The measured quantities that can end a range, as range ends. */
export const quantityRangeEnds = (text: string, measured: readonly Measured[]): RangeAmount[] =>
  measured.filter((value) => standsAlone(text, value) && !isExponent(text, value)).map((value) => rangeEndOf(text, value));
