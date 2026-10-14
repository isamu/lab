import { linesOf } from "./lines.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { leadingText } from "./total.ts";

/**
 * Whether a document says what kind of document it is with one of the words: its title contains one (会議室ご利用御見積書,
 * Meeting Room Quote), or a field's label is one (見積番号：MR-0733, Quote number: Q-1). The title is the first line with
 * text after any front matter, and the first heading; a table row is neither. A label only starting with a word does not
 * count (Withholding tax: on an invoice), nor does a word in a sentence. Width and case are ignored. Pure.
 */

const LABEL_SEPARATOR = /[:：|]/u;
const HEADING = /^[ \t]*#+[ \t]*/u;
const TABLE_ROW = /^[ \t]*\|/u;
const FRONT_MATTER_FENCE = /^---[ \t]*$/u;

const keyOf = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

/** The lines after a front matter block (--- … --- at the very top); all of them when there is none. */
const afterFrontMatter = (lines: readonly string[]): readonly string[] => {
  if (!FRONT_MATTER_FENCE.test(lines[0] ?? "")) return lines;
  const close = lines.findIndex((line, index) => index > 0 && FRONT_MATTER_FENCE.test(line));
  return close === -1 ? lines : lines.slice(close + 1);
};

const titlesOf = (lines: readonly string[]): string[] => {
  const first = lines.find((line) => line.trim().length > 0 && !TABLE_ROW.test(line));
  const heading = lines.find((line) => HEADING.test(line));
  return [first, heading].flatMap((line) => (line === undefined ? [] : [keyOf(line.replace(HEADING, ""))]));
};

const labelOf = (line: string): string | undefined => {
  const lead = leadingText(line);
  const separator = LABEL_SEPARATOR.exec(lead);
  return separator === null ? undefined : keyOf(withoutEdgeMarks(lead.slice(0, separator.index)));
};

export const namesDocumentKind = (source: string, words: readonly string[]): boolean => {
  const keys = words.map(keyOf);
  const lines = afterFrontMatter(linesOf(source).map((line) => line.text));
  if (titlesOf(lines).some((title) => keys.some((key) => title.includes(key)))) return true;
  return lines.some((line) => {
    const label = labelOf(line);
    return label !== undefined && keys.includes(label);
  });
};
