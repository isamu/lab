// The date in a document's opening lines: a line that is only a date, or a labelled one, under the title ("January 17,
// 2024" below a centred heading in plain-text minutes, where the indented title block is no paragraph). Pure.
import type { Span } from "../plugin.ts";
import { dateStampIndexes, stampCandidates } from "../date-stamp.ts";

/** How many non-blank lines after the front matter make the title block. */
const OPENING_LINES = 5;
/** How many lines from the top are read at most, blank ones and front matter included. */
const LINE_REACH = 64;
const FRONT_MATTER_FENCE = "---";

export type DatedSpan = Span & { readonly value: string };

type Line = Span & { readonly text: string };

const firstLines = (source: string): Line[] =>
  source.split("\n", LINE_REACH).reduce<Line[]>((lines, text) => {
    const start = (lines.at(-1)?.end ?? -1) + 1;
    lines.push({ start, end: start + text.length, text });
    return lines;
  }, []);

/** The lines after a Markdown front matter block ("---" … "---" at the very top), or all of them. */
const afterFrontMatter = (lines: readonly Line[]): readonly Line[] => {
  if (lines[0]?.text.trim() !== FRONT_MATTER_FENCE) return lines;
  const close = lines.findIndex((line, index) => index > 0 && line.text.trim() === FRONT_MATTER_FENCE);
  return close === -1 ? lines : lines.slice(close + 1);
};

const openingLines = (source: string): Line[] =>
  afterFrontMatter(firstLines(source))
    .filter((line) => line.text.trim() !== "")
    .slice(0, OPENING_LINES);

const firstDateIn = (dates: readonly DatedSpan[], line: Span | undefined): string | undefined =>
  line === undefined ? undefined : dates.find((date) => date.start >= line.start && date.end <= line.end)?.value;

/**
 * The first date of the first opening line that is a date stamp, as the tree reads it ("2024-01-17"). A label on a line of
 * its own ("Date:") takes the date on the line after it.
 */
export const openingDateOf = (source: string, dates: readonly DatedSpan[], labels: readonly string[]): string | undefined => {
  const lines = openingLines(source);
  const stamps = dateStampIndexes(stampCandidates(source, lines, dates), labels);
  const at = lines.findIndex((_, index) => stamps.has(index));
  return at === -1 ? undefined : (firstDateIn(dates, lines[at]) ?? firstDateIn(dates, lines[at + 1]));
};
