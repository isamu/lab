// "PART I - THE AGENCIES GENERALLY", "SUBCHAPTER II - ADMINISTRATIVE PROCEDURE": a heading line that sets a numbered
// division's label apart from its title with a spaced hyphen. The hyphen is the label's separator, not a dash in a
// sentence. Which words name a numbered division comes from the language's lexicon (numbered-division). Pure.
import { escapeRegExp } from "../orthography.ts";

/** The division's number: arabic with an optional letter (5, 12A) or roman (II). */
const NUMBER = String.raw`(?:\d{1,4}[A-Z]?|[IVXLCivxlc]{1,7})`;

/** The pattern of a line's text up to the hyphen when it is a division's label alone, or undefined without divisions. */
export const divisionLabelPattern = (divisions: readonly string[]): RegExp | undefined =>
  divisions.length === 0 ? undefined : new RegExp(String.raw`^\s*(?:#{1,6}\s+)?(?:${divisions.map(escapeRegExp).join("|")})\s+${NUMBER}\s*$`, "iu");

/** After the hyphen, a title to the end of the line: it starts with a capital and is not a sentence ("THE AGENCIES"). */
const TITLE_AFTER = /^\s*-{1,2}\s+\p{Lu}[^.!?]*$/u;

/**
 * Whether the hyphen at `offset` stands between a numbered division's label, alone from the start of its line, and a
 * title that runs to the end of the line.
 */
export const isDivisionSeparator = (source: string, offset: number, pattern: RegExp | undefined): boolean => {
  if (pattern === undefined || offset < 0 || offset > source.length) return false;
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = source.indexOf("\n", offset);
  return pattern.test(source.slice(lineStart, offset)) && TITLE_AFTER.test(source.slice(offset, lineEnd === -1 ? source.length : lineEnd).trimEnd());
};
