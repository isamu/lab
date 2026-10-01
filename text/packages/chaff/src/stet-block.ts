/**
 * Where a `<!-- stet: … -->` stops: the end of the block right below it, as a writer sees blocks in Markdown or plain
 * text. A blank line ends a paragraph or a table; a heading is a block of its own; a list runs on across the blank
 * lines between its items. Line numbers count from 1, as findings do.
 */

const BLANK = /^\s*$/u;
const HEADING = /^ {0,3}#{1,6}(?:\s|$)/u;
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d{1,9}[.)])(?:\s|$)/u;
/** A line indented under a list item: its continuation, or a nested list. */
const UNDER_ITEM = /^(?: {2,}|\t)\S/u;

const isBlank = (line: string): boolean => BLANK.test(line);

/** The index of the first non-blank line at or after `from`, or undefined at the end of the text. */
const firstFilled = (lines: readonly string[], from: number): number | undefined => {
  const offset = lines.slice(from).findIndex((line) => !isBlank(line));
  return offset === -1 ? undefined : from + offset;
};

/** The index of the last line of the run of lines from `start` that a blank line or a heading ends. */
const runEnd = (lines: readonly string[], start: number): number => {
  const offset = lines.slice(start + 1).findIndex((line) => isBlank(line) || HEADING.test(line));
  return offset === -1 ? lines.length - 1 : start + offset;
};

/** After a list's run ending at `end`, the index where the list goes on past blank lines, or undefined where it ends. */
const listResumesAt = (lines: readonly string[], end: number): number | undefined => {
  const next = firstFilled(lines, end + 1);
  const line = next === undefined ? "" : (lines[next] ?? "");
  if (next === undefined || HEADING.test(line)) return undefined;
  return LIST_ITEM.test(line) || UNDER_ITEM.test(line) ? next : undefined;
};

const listEnd = (lines: readonly string[], start: number): number => {
  const end = runEnd(lines, start);
  const resumed = listResumesAt(lines, end);
  return resumed === undefined ? end : listEnd(lines, resumed);
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
