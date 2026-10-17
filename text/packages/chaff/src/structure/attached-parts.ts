// Where an instrument attached to the document starts: a title line naming it (Exhibit A to Merger Agreement, Annex 1).
// What is attached is a separate document (a restated charter, a form of note), so its definitions are its own. Pure.
import { escapeRegExp } from "../orthography.ts";
import { isTitleLine, type TitleNotion } from "../title-line.ts";

/** An instrument's title: any case (EXHIBIT A to the merger agreement), but no `: ; ,` after it, and only blank lines around. */
export const INSTRUMENT_TITLE: TitleNotion = { sentenceEnd: /[.!?。．？！:;,]$/u, capitalised: false, edge: "blank-line" };

const linesOf = (source: string): { readonly start: number; readonly text: string }[] => {
  const starts = [0, ...[...source.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, index) => ({ start, text: source.slice(start, (starts[index + 1] ?? source.length + 1) - 1) }));
};

/**
 * The offsets of the lines that open an attached instrument: the line holds a label (Exhibit, Annex), its letter or
 * number and at most a short title with no full stop, and a blank line or the document's edge is on both sides.
 */
export const attachedPartStarts = (source: string, labels: readonly string[]): number[] => {
  const words = labels.filter((label) => label !== "").map(escapeRegExp);
  if (words.length === 0) return [];
  const title = new RegExp(String.raw`^[ \t]*(?:#{1,6}[ \t]+)?(?:${words.join("|")})[ \t]+[A-Z0-9](?:[A-Z0-9\-]|\.(?=[A-Z0-9]))*(?=[ \t\r]|$)`, "u");
  const lines = linesOf(source);
  return lines.flatMap((line, index) => {
    const label = title.exec(line.text);
    if (label === null) return [];
    const lineEnd = index === lines.length - 1 ? -1 : line.start + line.text.length;
    return isTitleLine(source, line.start, lineEnd, line.text.slice(label[0].length), INSTRUMENT_TITLE) ? [line.start] : [];
  });
};

/** Which part an offset falls in: 0 for the document itself, n for the n-th attached instrument. */
export const partAt = (starts: readonly number[], offset: number): number => starts.filter((start) => start <= offset).length;
