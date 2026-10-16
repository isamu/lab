import type { Span } from "chaffjs/plugin";

/**
 * Items written one per line with no blank line between them ("(a) …;\n(b) …", plain-text "1." or "-" lines, lines that
 * were `<br>`). An item seldom ends in a full stop, so the splitter reads the whole run as one sentence.
 *
 * English is hard-wrapped, and a wrapped line can start like an item ("in Section 2\n(a) of this Agreement", "in
 * RFC\n793.  It"). So a break before an item is cut only on a cue: the line before ends a lead-in or an item, the next
 * marker continues the list ("-" after "-", "(b)" after "(a)"), both lines are items and the next starts with a capital,
 * or a bracketed marker is followed by a capital. A break after
 * an item into a line with no marker is never cut: that line continues the item as often as it starts new text.
 */

const PAREN = String.raw`\((?:\d{1,3}[A-Z]?|[a-z]{1,2}|[A-Z]|[ivxlc]{2,6}|[IVXLC]{2,6})\)`;
const NUMBER = String.raw`\d{1,3}(?:\.\d{1,3})*[.)]|\d{1,3}(?:\.\d{1,3})+`;
const LETTER = String.raw`[a-z][.)]`;
const BULLET = "[-–•●▪◦‣*·]";

/** The marker, then the first character of the item's text. A marker other than a bracketed one needs a space after it. */
const MARKER = new RegExp(String.raw`^[ \t]*(?:(${PAREN})[ \t]*|(${NUMBER}|${LETTER}|${BULLET})[ \t]+)(\S)?`, "u");

/** marker: as written ("(a)", "2.", "-"). capital: the item's text starts with a capital or a digit. */
type Item = { readonly marker: string; readonly bracketed: boolean; readonly capital: boolean };

const itemOf = (line: string): Item | undefined => {
  const match = MARKER.exec(line);
  if (match === null) return undefined;
  return { marker: match[1] ?? match[2] ?? "", bracketed: match[1] !== undefined, capital: /[\p{Lu}\d]/u.test(match[3] ?? "") };
};

const BULLET_ONLY = new RegExp(`^${BULLET}$`, "u");

/** A number or a single letter between the same brackets or before the same stop ("(a)", "2.", "b)"). */
const SEQUENCED = /^(\(?)(\d{1,3}|[a-zA-Z])([.)]?)$/u;

const nextLabel = (label: string): string => (/\d/u.test(label) ? String(Number(label) + 1) : String.fromCharCode(label.charCodeAt(0) + 1));

/** The second marker continues the first: the same bullet ("-", "-"), or the next number or letter written alike ("(a)", "(b)"). */
const continuesList = (first: string, second: string): boolean => {
  if (BULLET_ONLY.test(first)) return first === second;
  const [, open, label, close] = SEQUENCED.exec(first) ?? [];
  if (label === undefined) return false;
  return second === `${open ?? ""}${nextLabel(label)}${close ?? ""}`;
};

/** Whether the line starts with a list marker. */
export const startsWithListMarker = (line: string): boolean => itemOf(line) !== undefined;

/** The end of a line, without a Markdown hard break ("\" or trailing spaces). */
const endOf = (line: string): string => {
  const trimmed = line.trimEnd();
  return trimmed.endsWith("\\") ? trimmed.slice(0, -1).trimEnd() : trimmed;
};

/** A lead-in or an item that ends here: the next item is a new sentence whatever it starts with. */
const LEAD_IN_END = /(?:[:;—–]|[;,:][ \t]*(?:and|or|and\/or|but|then))$/u;
/** Ends the line's own item: a comma or a conjunction after it, when the line is an item too. */
const ITEM_END = /(?:,|\b(?:and|or))$/u;
/** A full stop the splitter may have read as an abbreviation ("Inc.", "U.S."). */
const STOP_END = /[.?!]["”’)]?$/u;

const isCut = (previous: string, next: string): boolean => {
  const item = itemOf(next);
  if (item === undefined) return false;
  const end = endOf(previous);
  const before = itemOf(previous);
  const previousIsItem = before !== undefined;
  if (LEAD_IN_END.test(end)) return true;
  if (before !== undefined && continuesList(before.marker, item.marker)) return true;
  if (previousIsItem && ITEM_END.test(end)) return true;
  if (!item.capital) return false;
  return previousIsItem || item.bracketed || STOP_END.test(end);
};

type Line = { readonly start: number; readonly end: number; readonly text: string };

const NEWLINE = /\r?\n/gu;

const linesOf = (text: string): Line[] => {
  const breaks = [...text.matchAll(NEWLINE)];
  const starts = [0, ...breaks.map((match) => match.index + match[0].length)];
  return starts.map((start, index) => {
    const end = breaks[index]?.index ?? text.length;
    return { start, end, text: text.slice(start, end) };
  });
};

const indentOf = (line: Line): number => line.text.length - line.text.trimStart().length;

/** The line breaks that end a sentence: from the end of the line before to the first character of the item. */
export const listLineBreaks = (text: string): Span[] => {
  const lines = linesOf(text);
  return lines.slice(1).flatMap((next, index) => {
    const previous = lines[index];
    if (previous === undefined || previous.text.trim() === "" || !isCut(previous.text, next.text)) return [];
    return [{ start: previous.end, end: next.start + indentOf(next) }];
  });
};

/** Each item's head: from the start of its line to the marker's first character. A sentence starting here starts an item. */
export const listItemHeads = (text: string): Span[] =>
  linesOf(text).flatMap((line) => (startsWithListMarker(line.text) ? [{ start: line.start, end: line.start + indentOf(line) + 1 }] : []));

/** Whether offset is inside one of the heads (in order, not overlapping). */
export const startsListItem = (heads: readonly Span[], offset: number): boolean => {
  const search = (low: number, high: number): Span | undefined => {
    if (low >= high) return heads[low - 1];
    const middle = (low + high) >> 1;
    return (heads[middle]?.start ?? Number.POSITIVE_INFINITY) > offset ? search(low, middle) : search(middle + 1, high);
  };
  const head = search(0, heads.length);
  return head !== undefined && offset < head.end;
};

/** In breaks (in order, not overlapping), the index of the first one whose start passes the test. */
const firstWhere = (breaks: readonly Span[], test: (part: Span) => boolean): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return low;
    const middle = (low + high) >> 1;
    const part = breaks[middle];
    return part !== undefined && test(part) ? search(low, middle) : search(middle + 1, high);
  };
  return search(0, breaks.length);
};

/** The span cut at the breaks inside it. The piece before a break ends where the line ends; the next starts at the item. */
export const cutAtBreaks = (span: Span, breaks: readonly Span[]): Span[] => {
  const inside = breaks.slice(
    firstWhere(breaks, (part) => part.start > span.start),
    firstWhere(breaks, (part) => part.end >= span.end),
  );
  const starts = [span.start, ...inside.map((part) => part.end)];
  return starts.map((start, index) => ({ start, end: inside[index]?.start ?? span.end }));
};
