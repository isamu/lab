// Where an instrument attached to the document starts: a title line naming it (Exhibit A to Merger Agreement, Annex 1).
// What is attached is a separate document (a restated charter, a form of note), so its definitions are its own. Pure.
import { escapeRegExp } from "../orthography.ts";
import { isShortTitle, isTitleLine, type TitleNotion } from "../title-line.ts";

/** An instrument's title: any case (EXHIBIT A to the merger agreement), but no `: ; ,` after it, and only blank lines around. */
export const INSTRUMENT_TITLE: TitleNotion = { sentenceEnd: /[.!?。．？！:;,]$/u, capitalised: false, edge: "blank-line" };

/** Bold around a title (## **SCHEDULE A**) is only how it is shown. */
const BOLD = /\*\*/gu;
/** A Markdown heading is a block of its own, so it needs no blank line around it (a closing fence may sit just above). */
const MARKDOWN_HEADING = /^ {0,3}#{1,6}[ \t]/u;

type Line = { readonly start: number; readonly text: string };

const linesOf = (source: string): Line[] => {
  const starts = [0, ...[...source.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, index) => ({ start, text: source.slice(start, (starts[index + 1] ?? source.length + 1) - 1) }));
};

const opensInstrument = (source: string, lines: readonly Line[], index: number, title: RegExp): boolean => {
  const line = lines[index];
  if (line === undefined) return false;
  const text = line.text.replace(BOLD, "");
  const label = title.exec(text);
  if (label === null) return false;
  const rest = text.slice(label[0].length);
  if (MARKDOWN_HEADING.test(text)) return isShortTitle(rest, INSTRUMENT_TITLE);
  const lineEnd = index === lines.length - 1 ? -1 : line.start + line.text.length;
  return isTitleLine(source, line.start, lineEnd, rest, INSTRUMENT_TITLE);
};

/**
 * The offsets of the lines that open an attached instrument: the line holds a label (Exhibit, Annex), its letter or
 * number and at most a short title with no full stop, and it is a Markdown heading or has a blank line or the
 * document's edge on both sides. Bold around the title is ignored.
 */
export const attachedPartStarts = (source: string, labels: readonly string[]): number[] => {
  const words = labels.filter((label) => label !== "").map(escapeRegExp);
  if (words.length === 0) return [];
  const title = new RegExp(String.raw`^[ \t]*(?:#{1,6}[ \t]+)?(?:${words.join("|")})[ \t]+[A-Z0-9](?:[A-Z0-9\-]|\.(?=[A-Z0-9]))*(?=[ \t\r]|$)`, "u");
  const lines = linesOf(source);
  return lines.flatMap((line, index) => (opensInstrument(source, lines, index, title) ? [line.start] : []));
};

/** Which part an offset falls in: 0 for the document itself, n for the n-th attached instrument. */
export const partAt = (starts: readonly number[], offset: number): number => starts.filter((start) => start <= offset).length;
