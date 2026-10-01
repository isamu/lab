/**
 * Where a `<!-- stet: … -->` stops: the end of the block right below it, as a writer sees blocks in Markdown or plain
 * text. A blank line ends a paragraph or a table; a heading (`#`, or a Setext underline) is a block of its own; a list runs on across the blank
 * lines between its items. Line numbers count from 1, as findings do.
 */

const BLANK = /^\s*$/u;
const HEADING = /^ {0,3}#{1,6}(?:\s|$)/u;
/** The underline of a Setext heading: the lines above it, up to it, are the heading. */
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)\s*$/u;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/u;
/** A line indented under a list item: its continuation, or a nested list. */
const UNDER_ITEM = /^(?: {2,}|\t)\S/u;

const isBlank = (line: string): boolean => BLANK.test(line);

/**
 * The index of the first line at or after `from` that passes `test`, or undefined. A plain loop: one stet can sit
 * above a list of thousands of items, and copying the rest of the text per item would be quadratic.
 */
const indexFrom = (lines: readonly string[], from: number, test: (line: string) => boolean): number | undefined => {
  for (let index = from; index < lines.length; index += 1) if (test(lines[index] ?? "")) return index;
  return undefined;
};

const firstFilled = (lines: readonly string[], from: number): number | undefined => indexFrom(lines, from, (line) => !isBlank(line));

/** The index of the last line of the run from `start`: before a blank line or a heading, or at a Setext underline. */
const runEnd = (lines: readonly string[], start: number): number => {
  const stop = indexFrom(lines, start + 1, (line) => isBlank(line) || HEADING.test(line) || SETEXT_UNDERLINE.test(line));
  if (stop === undefined) return lines.length - 1;
  return SETEXT_UNDERLINE.test(lines[stop] ?? "") ? stop : stop - 1;
};

/** After a list's run ending at `end`, the index where the list goes on past blank lines, or undefined where it ends. */
const listResumesAt = (lines: readonly string[], end: number): number | undefined => {
  const next = firstFilled(lines, end + 1);
  const line = next === undefined ? "" : (lines[next] ?? "");
  if (next === undefined || HEADING.test(line)) return undefined;
  return LIST_ITEM.test(line) || UNDER_ITEM.test(line) ? next : undefined;
};

/** A list's last line: its runs, joined across the blank lines between items. A loop, not recursion, for long lists. */
const listEnd = (lines: readonly string[], start: number): number => {
  let end = runEnd(lines, start);
  let resumed = listResumesAt(lines, end);
  while (resumed !== undefined) {
    end = runEnd(lines, resumed);
    resumed = listResumesAt(lines, end);
  }
  return end;
};

/**
 * The last line a `stet` (scope next) covers. `closingLine` is the line where the comment closes; `textAfter` says
 * whether text follows the comment on that line, which then starts the block.
 */
export const stetBlockEnd = (lines: readonly string[], closingLine: number, textAfter: boolean): number => {
  const start = firstFilled(lines, textAfter ? closingLine - 1 : closingLine);
  if (start === undefined) return closingLine;
  const first = lines[start] ?? "";
  if (HEADING.test(first)) return start + 1;
  return (LIST_ITEM.test(first) ? listEnd(lines, start) : runEnd(lines, start)) + 1;
};
