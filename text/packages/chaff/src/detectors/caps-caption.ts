/**
 * Captions set in capitals: a capital run that opens a paragraph and ends in a colon ("AGENCY:", "DIRECT HIRE AUTHORITY:
 * This position is …"), or that is a paragraph of its own ("WORKING GROUP MEMBERS"). Notices, forms and reports set their
 * captions this way by convention, and prose that names one ("the FOR FURTHER INFORMATION CONTACT section") repeats it.
 * A line of a hard-wrapped paragraph in capitals (a disclaimer) has text above it, so it is no caption.
 */

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
