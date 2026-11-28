// Entries of a reference list keyed by a bracketed label, as an RFC prints them:
//
//    [FETCH]    WHATWG, "Fetch - Living Standard",
//               <https://fetch.spec.whatwg.org/>.
//
// A label too long for its column leaves one space, or stands alone on its line, before the entry's indented lines:
//
//    [CERT.CVD] Software Engineering Institute, "The CERT Guide to
//               Coordinated Vulnerability Disclosure", August 2017.
//
//    [ISO.29147.2018]
//               ISO, "Information technology - Security techniques -
//
// The entry is written in the cited work's words. Pure.

type Span = { readonly start: number; readonly end: number };

const LABEL = String.raw`^(?<indent>[ \t]*)\[(?<label>[A-Za-z0-9][\w.:+-]*)\]`;
/** A label in square brackets opening a line, then a wide gap: two spaces or a tab. A link definition ([x]: url) has a colon. */
const ENTRY_START = new RegExp(String.raw`${LABEL}(?: {2,}|\t)\S`, "u");
/**
 * A label followed by one space or by the end of its line. Prose opens a line with a bracketed citation too ("[JSON] and XML
 * [XML] document formats"), so this starts an entry only when the next line is indented deeper than the label.
 */
const LONG_LABEL_START = new RegExp(String.raw`${LABEL}(?: \S|$)`, "u");

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

type EntryStart = { readonly indent: number; readonly label: string };

/** The entry that opens at this line, if one does. */
const entryStartAt = (lines: readonly Line[], at: number): EntryStart | undefined => {
  const text = lines[at]?.text ?? "";
  const wide = ENTRY_START.exec(text)?.groups;
  if (wide !== undefined) return { indent: (wide["indent"] ?? "").length, label: wide["label"] ?? "" };
  const long = LONG_LABEL_START.exec(text)?.groups;
  if (long === undefined) return undefined;
  const indent = (long["indent"] ?? "").length;
  const next = lines[at + 1]?.text ?? "";
  return next.trim() !== "" && indentOf(next) > indent ? { indent, label: long["label"] ?? "" } : undefined;
};

export const referenceEntrySpans = (source: string): Span[] => {
  const lines = linesOf(source);
  return lines.flatMap((line, at) => {
    const entry = entryStartAt(lines, at);
    if (entry === undefined) return [];
    const last = lines[entryEnd(lines, at, entry.indent) - 1] ?? line;
    return [{ start: line.start, end: last.start + last.text.length }];
  });
};

/**
 * The labels of the entries ([UNIX]    The Open Group, "The Single UNIX Specification"). The entry says what the label names,
 * so the label written in prose (a UNIX timestamp) is explained by it.
 */
export const referenceEntryLabels = (source: string): ReadonlySet<string> => {
  const lines = linesOf(source);
  return new Set(lines.flatMap((_, at) => entryStartAt(lines, at)?.label ?? []));
};
