// serial-range-reversed: the serial, lot and batch codes that may be one end of a range (A2400〜A1800, SN-1200 to SN-0900),
// read as the ends structure/amount-range.ts compares, and the ranges a serial label on their line makes ranges of codes. Pure.
import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";
import type { RangeAmount } from "./amount-range.ts";

/** Fewer digits than this are a section or a grade (A1, B12), not a serial number. */
const MIN_DIGITS = 3;

/** One to four capital letters, an optional hyphen, the digits; not inside a longer word or number (XA2400, A2400B). */
const CODE = new RegExp(`(?<![A-Za-zＡ-Ｚａ-ｚ0-9０-９_])([A-ZＡ-Ｚ]{1,4})([-‐－]?)([0-9０-９]{${MIN_DIGITS},})(?![A-Za-zＡ-Ｚａ-ｚ0-9０-９_])`, "gu");

/**
 * A code as one end of a range: two ends compare only when their letters, their hyphen and their number of digits agree
 * (A2400 with A1800; not with B0100, A-1800 or A240).
 */
const rangeEndOf = (match: RegExpMatchArray): RangeAmount => {
  const [whole, letters = "", hyphen = "", digits = ""] = match;
  const offset = match.index ?? 0;
  const width = digits.length;
  return {
    offset,
    end: offset + whole.length,
    currency: `${letters.normalize("NFKC")}|${hyphen === "" ? "" : "-"}|${width}`,
    value: Number(digits.normalize("NFKC")),
    scale: undefined,
    position: "after",
  };
};

/** The serial-shaped codes in the text, as range ends, in document order. */
export const serialRangeEnds = (text: string): RangeAmount[] => [...text.matchAll(CODE)].map(rangeEndOf);

/** A number pattern that never matches: a bare number never shares a code's letters (A2400〜1800 is not read). */
export const NO_BARE_NUMBER = "(?!)";

const LATIN = /^[A-Za-z]/u;

const labelPattern = (label: string): RegExp => {
  const escaped = escapeRegExp(label.toLowerCase());
  return new RegExp(LATIN.test(label) ? `(?<![a-z0-9_])${escaped}(?![a-z0-9_])` : escaped, "u");
};

/** Whether a serial label stands on the line before the range (製造番号：A2400〜A1800, Lots L5240 through L5210). */
const labelled = (text: string, offset: number, labels: readonly string[]): boolean => {
  const before = text.slice(text.lastIndexOf("\n", offset - 1) + 1, offset).toLowerCase();
  return labels.some((label) => labelPattern(label).test(before));
};

/** The reversed ranges of codes that a serial label on their line names as serial, lot or batch numbers. */
export const labelledRanges = (text: string, issues: readonly StructureIssue[], labels: readonly string[]): StructureIssue[] =>
  issues.filter((issue) => labelled(text, issue.offset, labels));
