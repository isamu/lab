// "PART I - THE AGENCIES GENERALLY", "SUBCHAPTER II - ADMINISTRATIVE PROCEDURE": a heading line that sets a numbered
// division's label apart from its title with a spaced hyphen. The hyphen is the label's separator, not a dash in a
// sentence. Which words name a numbered division comes from the language's lexicon (numbered-division). Pure.
import { escapeRegExp } from "../orthography.ts";

/** The division's number: arabic with an optional letter (5, 12A) or roman (II). */
const NUMBER = String.raw`(?:\d{1,4}[A-Z]?|[IVXLCivxlc]{1,7})`;

/** The pattern of a line's text up to the hyphen when it is a division's label alone, or undefined without divisions. */
export const divisionLabelPattern = (divisions: readonly string[]): RegExp | undefined =>
  divisions.length === 0 ? undefined : new RegExp(String.raw`^\s*(?:#{1,6}\s+)?(?:${divisions.map(escapeRegExp).join("|")})\s+${NUMBER}\s*$`, "iu");

/** Whether the text from the start of its line up to `offset` is a numbered division's label and nothing else. */
export const isDivisionSeparator = (source: string, offset: number, pattern: RegExp | undefined): boolean => {
  if (pattern === undefined || offset < 0 || offset > source.length) return false;
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  return pattern.test(source.slice(lineStart, offset));
};
