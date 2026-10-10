// quantity-range-reversed: which measured quantities may be one end of a range, read as the ends structure/amount-range.ts
// compares. Pure.
import type { Measured } from "../facts/measures.ts";
import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";
import type { RangeAmount } from "./amount-range.ts";

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
  measured.filter((value) => !isExponent(text, value)).map((value) => rangeEndOf(text, value));

const LATIN_WORD = /^[A-Za-z]/u;

/** Whether a lead word stands right before the range on its line ("went from 9 minutes to 2 minutes" tells of a change). */
const ledBy = (text: string, offset: number, leads: readonly string[]): boolean => {
  const before = text
    .slice(text.lastIndexOf("\n", offset - 1) + 1, offset)
    .trimEnd()
    .toLowerCase();
  return leads.some((lead) => {
    const edge = LATIN_WORD.test(lead) ? "(?<![a-z])" : "";
    return new RegExp(`${edge}${escapeRegExp(lead.toLowerCase())}$`, "u").test(before);
  });
};

/** The reversed ranges that no lead word frames as a change. */
export const unledRanges = (text: string, issues: readonly StructureIssue[], leads: readonly string[]): StructureIssue[] =>
  issues.filter((issue) => !ledBy(text, issue.offset, leads));
