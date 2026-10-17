// The date in a document's opening lines: a line that is only a date, or a labelled one, under the title ("January 17,
// 2024" below a centred heading in plain-text minutes, where the indented title block is no paragraph). Pure.
import type { Span } from "../plugin.ts";
import { dateStampIndexes, stampCandidates } from "../date-stamp.ts";

/** How many non-blank lines from the top make the title block. */
const OPENING_LINES = 5;

export type DatedSpan = Span & { readonly value: string };

const NON_BLANK_LINE = /^[^\S\n]*\S[^\n]*$/gmu;

const openingLines = (source: string): Span[] =>
  [...source.matchAll(NON_BLANK_LINE)].slice(0, OPENING_LINES).map((line) => ({ start: line.index, end: line.index + line[0].length }));

/** The first date of the first opening line that is a date stamp, as the tree reads it ("2024-01-17"). */
export const openingDateOf = (source: string, dates: readonly DatedSpan[], labels: readonly string[]): string | undefined => {
  const lines = openingLines(source);
  const stamps = dateStampIndexes(stampCandidates(source, lines, dates), labels);
  const line = lines.find((_, index) => stamps.has(index));
  return line === undefined ? undefined : dates.find((date) => date.start >= line.start && date.end <= line.end)?.value;
};
