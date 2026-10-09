import type { DatedSpan } from "./date-range.ts";
import type { StructureIssue } from "./issues.ts";
import { linesOf } from "./lines.ts";

/**
 * A document's stamp dates out of order: an established date (2024年10月1日 制定, Established: April 1, 2023) later than an
 * update (2024年9月1日 最終改定, Last updated: September 1, 2024). A stamp line (or one part of a line that holds several dates)
 * holds one full date and, once the date is taken out, nothing but one stamp word (with colons, brackets, emphasis or a list
 * marker around it). Only stamps written together are compared. Both stamps are reported, each naming the other: nothing tells
 * which of the two dates is the wrong one. Pure; the stamp words come from the caller.
 */
export type StampWords = { readonly established: readonly string[]; readonly updated: readonly string[] };

type Stamp = { readonly kind: "established" | "updated"; readonly date: DatedSpan; readonly line: number };

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
/** How many lines apart two stamps may be and still be one document's stamp block; further apart, they date two documents. */
const MAX_LINE_GAP = 6;
/** What may stand around a stamp word: spaces, colons, brackets, table bars, Markdown emphasis and list markers. */
const AROUND_WORD = /[\s:：*_()（）[\]「」【】|｜\-‐−・]/u;
/** A part of a line between a wide space, a tab or a bar. */
const FIELD = /[^\t\u3000|｜]+/gu;

const bareWord = (text: string): string => {
  const chars = [...text];
  const first = chars.findIndex((char) => !AROUND_WORD.test(char));
  const last = chars.findLastIndex((char) => !AROUND_WORD.test(char));
  return first === -1
    ? ""
    : chars
        .slice(first, last + 1)
        .join("")
        .toLowerCase();
};

const kindOf = (word: string, words: StampWords): Stamp["kind"] | undefined => {
  const isOne = (list: readonly string[]): boolean => list.some((entry) => entry.toLowerCase() === word);
  if (isOne(words.established)) return "established";
  return isOne(words.updated) ? "updated" : undefined;
};

type Field = { readonly start: number; readonly end: number; readonly line: number };

const datesIn = (dates: readonly DatedSpan[], field: Field): DatedSpan[] => dates.filter((date) => date.offset >= field.start && date.end <= field.end);

/** A line, or, when it holds more than one date, its parts between wide spaces, tabs and bars (作成：平成16年2月4日, a wide space, 最終改定：令和3年11月19日). */
const fieldsOf = (source: string, dates: readonly DatedSpan[]): Field[] =>
  linesOf(source).flatMap((line) => {
    const whole = { start: line.start, end: line.start + line.text.length, line: line.number };
    if (datesIn(dates, whole).length < 2) return [whole];
    return [...line.text.matchAll(FIELD)].map((match) => ({
      start: line.start + match.index,
      end: line.start + match.index + match[0].length,
      line: line.number,
    }));
  });

/** The stamps of a text: a line or field holding one full date and one stamp word, nothing else. */
const stampsOf = (source: string, dates: readonly DatedSpan[], words: StampWords): Stamp[] =>
  fieldsOf(source, dates).flatMap((field) => {
    const [date, ...more] = datesIn(dates, field);
    if (date === undefined || more.length > 0 || !FULL_DATE.test(date.value)) return [];
    const rest = `${source.slice(field.start, date.offset)} ${source.slice(date.end, field.end)}`;
    const kind = kindOf(bareWord(rest), words);
    return kind === undefined ? [] : [{ kind, date, line: field.line }];
  });

/** Stamps written together, each within MAX_LINE_GAP lines of the one before: one document's stamp block. */
const blocksOf = (stamps: readonly Stamp[]): Stamp[][] =>
  stamps.reduce<Stamp[][]>((blocks, stamp, index) => {
    const previous = stamps[index - 1];
    const last = blocks.at(-1);
    if (previous === undefined || last === undefined || stamp.line - previous.line > MAX_LINE_GAP) return [...blocks, [stamp]];
    return [...blocks.slice(0, -1), [...last, stamp]];
  }, []);

const valuesOf = (established: Stamp, updated: Stamp): Record<string, string> => ({ established: established.date.value, updated: updated.date.value });

/** In one block: each established stamp later than an update, against the latest such update, and each such update against the first such established stamp. */
const blockIssues = (block: readonly Stamp[]): StructureIssue[] => {
  const established = block.filter((stamp) => stamp.kind === "established");
  const updates = block.filter((stamp) => stamp.kind === "updated").toSorted((a, b) => b.date.value.localeCompare(a.date.value));
  const ofEstablished = established.flatMap((stamp) => {
    const latest = updates.find((updated) => updated.date.value < stamp.date.value);
    return latest === undefined ? [] : [{ offset: stamp.date.offset, values: valuesOf(stamp, latest) }];
  });
  const ofUpdates = updates.flatMap((updated) => {
    const later = established.find((stamp) => stamp.date.value > updated.date.value);
    return later === undefined ? [] : [{ offset: updated.date.offset, values: { ...valuesOf(later, updated), side: "updated" } }];
  });
  return [...ofEstablished, ...ofUpdates];
};

/** Each established stamp later than an update of its block, and each such update, the one naming the other. */
export const stampOrderIssues = (source: string, dates: readonly DatedSpan[], words: StampWords): StructureIssue[] => {
  if (words.established.length === 0 || words.updated.length === 0) return [];
  return blocksOf(stampsOf(source, dates, words))
    .flatMap(blockIssues)
    .toSorted((a, b) => a.offset - b.offset);
};
