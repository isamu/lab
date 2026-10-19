/**
 * Captions set in capitals: a capital run that opens a paragraph and ends in a colon ("AGENCY:", "DIRECT HIRE AUTHORITY:
 * This position is …"), or that is a paragraph of its own ("WORKING GROUP MEMBERS"). Notices, forms and reports set their
 * captions this way by convention, and prose that names one ("the FOR FURTHER INFORMATION CONTACT section") repeats it.
 * A line of a hard-wrapped paragraph in capitals (a disclaimer) has text above it, so it is no caption.
 */
import { linesOf, type Line } from "../structure/lines.ts";
import type { Span } from "../plugin.ts";

/** Markdown heading or list marks and spaces that may stand before a caption on its line. */
const LINE_LEAD = /^[ \t]*(?:#{1,6}[ \t]+|[-*+][ \t]+)?$/u;
const BLANK_LINE = /^[ \t\r]*$/u;
const LINE_END = /^[ \t\r]*(?:\n|$)/u;
const LEAD = /^[ \t]*(?:#{1,6}[ \t]+|[-*+][ \t]+)?/u;
const CAPITAL_RUN = /^[A-Z][A-Z']*(?:,? [A-Z][A-Z']*)*/u;

/** The line before the one that starts at lineStart, or undefined at the start of the source. */
const lineBefore = (source: string, lineStart: number): string | undefined =>
  lineStart === 0 ? undefined : source.slice(source.lastIndexOf("\n", lineStart - 2) + 1, lineStart - 1);

const opensParagraph = (source: string, lineStart: number): boolean => {
  const above = lineBefore(source, lineStart);
  return above === undefined || BLANK_LINE.test(above);
};

/** Whether the text after a run ends the caption: a colon, or the end of a paragraph. */
const endsCaption = (rest: string): boolean => {
  if (rest.startsWith(":")) return true;
  if (!LINE_END.test(rest)) return false;
  const next = rest.slice(rest.indexOf("\n") + 1).split("\n", 1)[0] ?? "";
  return !rest.includes("\n") || BLANK_LINE.test(next);
};

/** Whether the capital run at [start, end) of the source is a caption: it opens its paragraph and ends in a colon or the paragraph's end. */
export const isCaptionAt = (source: string, start: number, end: number): boolean => {
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  return LINE_LEAD.test(source.slice(lineStart, start)) && opensParagraph(source, lineStart) && endsCaption(source.slice(end));
};

/** The capital run that opens a line, after its heading or list mark, with where it starts in the source. */
const runOpening = (line: string, lineStart: number): { readonly words: string; readonly start: number } | undefined => {
  const lead = LEAD.exec(line)?.[0].length ?? 0;
  const words = CAPITAL_RUN.exec(line.slice(lead))?.[0];
  return words === undefined ? undefined : { words, start: lineStart + lead };
};

/** The captions a source sets in capitals, each as its words ("FOR FURTHER INFORMATION CONTACT"). */
export const captionsOf = (source: string): ReadonlySet<string> => {
  const lines = source.split("\n");
  const starts = lines.reduce<number[]>(
    (acc, line) => {
      acc.push((acc.at(-1) ?? 0) + line.length + 1);
      return acc;
    },
    [0],
  );
  return new Set(
    lines.flatMap((line, at) => {
      const run = runOpening(line, starts[at] ?? 0);
      return run !== undefined && isCaptionAt(source, run.start, run.start + run.words.length) ? [run.words] : [];
    }),
  );
};

/** A line ends a sentence when its last mark, past closing quotes and brackets, is a period, a question or an exclamation mark. */
const SENTENCE_END = /[.!?]["'”’)\]]*[ \t\r]*$/u;
const UPPER = /[A-Z]/u;
const LOWER = /[a-z]/u;

const isCapitalLine = (line: Line): boolean => {
  const bare = line.text.replace(LEAD, "");
  return UPPER.test(bare) && !LOWER.test(bare);
};

/** The lines in paragraphs: runs of lines between blank lines. */
const paragraphsOf = (lines: readonly Line[]): Line[][] =>
  lines.reduce<Line[][]>((paragraphs, line, index) => {
    if (BLANK_LINE.test(line.text)) return paragraphs;
    const above = lines[index - 1];
    if (above !== undefined && !BLANK_LINE.test(above.text)) paragraphs.at(-1)?.push(line);
    else paragraphs.push([line]);
    return paragraphs;
  }, []);

const spanOf = (paragraph: readonly Line[]): Span[] => {
  const first = paragraph[0];
  const last = paragraph.at(-1);
  return first === undefined || last === undefined ? [] : [{ start: first.start, end: last.start + last.text.length }];
};

/**
 * The paragraphs whose every line is in capitals and none ends a sentence: a letterhead or an address block at the head
 * (BOARD OF GOVERNORS / WASHINGTON, D.C. 20551), and a heading a transcript sets in capitals on lines of its own
 * (OPENING STATEMENT OF HON. JANE DOE, / U.S. SENATOR FROM OHIO). A warning in capitals is sentences, so it is not one. A
 * document with no sentence has no prose to tell such a paragraph apart from.
 */
export const capitalParagraphSpans = (source: string): Span[] => {
  const paragraphs = paragraphsOf(linesOf(source));
  const endsSentence = (paragraph: readonly Line[]): boolean => paragraph.some((line) => SENTENCE_END.test(line.text));
  if (!paragraphs.some(endsSentence)) return [];
  return paragraphs.filter((paragraph) => paragraph.every(isCapitalLine) && !endsSentence(paragraph)).flatMap(spanOf);
};

/** Columns on a line: two spaces or more, or a tab, stand between them. */
const COLUMN_CELL = /[^\t ]+(?: [^\t ]+)*/gu;
/** A name in capitals, a comma, and a place or office in ordinary case: JANE Q. DOE, Ohio / JOHN DOE, JR., New Mexico. */
const ROSTER_CELL = /^([A-Z][A-Z.'’-]*(?: [A-Z][A-Z.'’-]*)*(?:, [JS]R\.)?), \p{Lu}\p{Ll}+(?: \p{Lu}\p{Ll}+)*$/u;

/**
 * The names of a roster: a column that holds a name in capitals and the member's place in ordinary case (a committee's
 * members, as a hearing sets them). A run in capitals followed by a comma and prose is no roster.
 */
export const rosterNameSpans = (source: string): Span[] =>
  linesOf(source).flatMap((line) =>
    [...line.text.matchAll(COLUMN_CELL)].flatMap((cell) => {
      const name = ROSTER_CELL.exec(cell[0])?.[1];
      const start = line.start + cell.index;
      return name === undefined ? [] : [{ start, end: start + name.length }];
    }),
  );
