// The numbers written on the items of a Markdown ordered list (「1.」「2.」「4.」) that skip or repeat. Markdown renders an
// ordered list from its first number on, but the source shows the numbers as written, and a "see step 4" points at those.
import type { Span } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";

const ITEM_NUMBER = /^(?<number>\d{1,9})(?<delimiter>[.)])[ \t]/u;

/** One item's written number: where the item starts, the number and the number as written (「4.」). */
export type WrittenNumber = { readonly offset: number; readonly number: number; readonly label: string };

/** The number written at the start of each item, or undefined when an item has none (a bulleted list). */
export const writtenNumbers = (source: string, itemSpans: readonly Span[]): WrittenNumber[] | undefined => {
  const numbers = itemSpans.map((span) => {
    const found = ITEM_NUMBER.exec(source.slice(span.start, span.end))?.groups;
    return found === undefined
      ? undefined
      : { offset: span.start, number: Number(found["number"]), label: `${found["number"] ?? ""}${found["delimiter"] ?? ""}` };
  });
  return numbers.every((entry) => entry !== undefined) ? numbers : undefined;
};

/**
 * Each item whose number is not one more than the item before it. A list that writes one number on every item (「1.」 on
 * each, which Markdown counts up) is numbered by the renderer, not by the writer, and is not read. An item numbered 1
 * starts a new count, as the structure rule reads a 1 that follows other items.
 */
export const listNumberBreaks = (items: readonly WrittenNumber[]): StructureIssue[] => {
  if (new Set(items.map((item) => item.number)).size < 2) return [];
  return items.flatMap((item, index) => {
    const previous = items[index - 1];
    if (previous === undefined || item.number === previous.number + 1 || item.number === 1) return [];
    return [{ offset: item.offset, values: { previous: previous.label, label: item.label, expected: previous.number + 1, found: item.number } }];
  });
};
