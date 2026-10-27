// Entries of a reference list keyed by a bracketed label, as an RFC prints them:
//
//    [FETCH]    WHATWG, "Fetch - Living Standard",
//               <https://fetch.spec.whatwg.org/>.
//
// The entry is written in the cited work's words. Pure.

type Span = { readonly start: number; readonly end: number };

/** A label in square brackets opening a line, then a wide gap: two spaces or a tab. A link definition ([x]: url) has a colon. */
const ENTRY_START = /^(?<indent>[ \t]*)\[[A-Za-z0-9][\w.:+-]*\](?: {2,}|\t)\S/u;

type Line = { readonly text: string; readonly start: number };

const linesOf = (source: string): Line[] =>
  source.split("\n").reduce<Line[]>((lines, text) => {
    const previous = lines.at(-1);
    lines.push({ text, start: previous === undefined ? 0 : previous.start + previous.text.length + 1 });
    return lines;
  }, []);

const indentOf = (text: string): number => text.length - text.trimStart().length;

/** The entry's own lines: the label's line and the lines after it indented deeper than the label, up to a blank line. */
// A loop from at: slicing the rest for every entry would be quadratic in a long reference list.
const entryEnd = (lines: readonly Line[], at: number, indent: number): number => {
  for (let index = at + 1; index < lines.length; index += 1) {
    const text = lines[index]?.text ?? "";
    if (text.trim() === "" || indentOf(text) <= indent) return index;
  }
  return lines.length;
};

export const referenceEntrySpans = (source: string): Span[] => {
  const lines = linesOf(source);
  return lines.flatMap((line, at) => {
    const indent = ENTRY_START.exec(line.text)?.groups?.["indent"];
    if (indent === undefined) return [];
    const last = lines[entryEnd(lines, at, indent.length) - 1] ?? line;
    return [{ start: line.start, end: last.start + last.text.length }];
  });
};
