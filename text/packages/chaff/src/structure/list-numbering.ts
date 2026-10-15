// The numbers written on the items of a Markdown ordered list (「1.」「2.」「4.」) that skip or repeat. Markdown renders an
// ordered list from its first number on, but the source shows the numbers as written, and a "see step 4" points at those.
import type { Span } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";

const ITEM_NUMBER = /^(?<number>\d{1,9})(?<delimiter>[.)])[ \t]/u;
const TAB_WIDTH = 4;

/** One item's written number: where the item starts and ends, its column, the number and the number as written (「4.」). */
export type WrittenNumber = {
  readonly offset: number;
  readonly number: number;
  readonly label: string;
  readonly indent?: number;
  readonly end?: number;
};

/** The column an offset sits at, a tab counted to the next stop of four as CommonMark counts it. */
const columnAt = (source: string, offset: number): number =>
  Array.from(source.slice(source.lastIndexOf("\n", offset - 1) + 1, offset)).reduce(
    (column, char) => (char === "\t" ? column + TAB_WIDTH - (column % TAB_WIDTH) : column + 1),
    0,
  );

const numberAt = (source: string, span: Span): { number: number; label: string } | undefined => {
  const found = ITEM_NUMBER.exec(source.slice(span.start, span.end))?.groups;
  return found === undefined ? undefined : { number: Number(found["number"]), label: `${found["number"] ?? ""}${found["delimiter"] ?? ""}` };
};

/** The number written at the start of each item, or undefined when an item has none (a bulleted list). */
export const writtenNumbers = (source: string, itemSpans: readonly Span[]): WrittenNumber[] | undefined => {
  const numbers = itemSpans.map((span) => {
    const found = numberAt(source, span);
    return found === undefined ? undefined : { offset: span.start, end: span.end, ...found, indent: columnAt(source, span.start) };
  });
  return numbers.every((entry) => entry !== undefined) ? numbers : undefined;
};

/** The last number of an ordered list nested in an item, if there is one. */
export type NestedLast = (item: WrittenNumber) => number | undefined;

type OrderedList = { readonly start: number; readonly end: number; readonly last: number };

const orderedListOf = (source: string, spans: readonly Span[]): OrderedList[] => {
  const first = spans[0];
  const last = writtenNumbers(source, spans)?.at(-1);
  return first === undefined || last === undefined ? [] : [{ start: first.start, end: last.end ?? last.offset, last: last.number }];
};

/**
 * For an item, the last number of the ordered list inside it that ends last (the outermost one, when lists nested in
 * each other end together). lists are the item spans of every list in the document; bulleted lists are left out.
 */
export const nestedLastFinder = (source: string, lists: readonly (readonly Span[])[]): NestedLast => {
  const ordered = lists.flatMap((spans) => orderedListOf(source, spans));
  return (item) =>
    ordered
      .filter((list) => list.start > item.offset && list.end <= (item.end ?? item.offset))
      .reduce<OrderedList | undefined>(
        (best, list) => (best === undefined || list.end > best.end || (list.end === best.end && list.start < best.start) ? list : best),
        undefined,
      )?.last;
};

type Compared = { readonly item: WrittenNumber; readonly previous: WrittenNumber | undefined };

const indentOf = (item: WrittenNumber): number => item.indent ?? 0;

/**
 * Which item each item's number follows. An item at the same indentation follows the last one there. An item indented
 * deeper starts a nested count (CommonMark can still put it in the same list, when the indentation falls short of the
 * parent's text), unless it carries on the count above it: the parent's number plus one (a slip of indentation), or
 * one past the last number of the list nested in the parent (that list, carried on at a different indentation).
 */
const comparedPairs = (items: readonly WrittenNumber[], nestedLast: NestedLast): Compared[] => {
  const open: WrittenNumber[] = [];
  return items.map((item) => {
    const popped: WrittenNumber[] = [];
    for (let top = open.at(-1); top !== undefined && indentOf(top) > indentOf(item); top = open.at(-1)) {
      popped.push(top);
      open.pop();
    }
    const parent = open.at(-1);
    if (parent !== undefined && indentOf(parent) === indentOf(item)) {
      open[open.length - 1] = item;
      return { item, previous: parent };
    }
    if (parent === undefined) {
      open.push(item);
      return { item, previous: popped.at(-1) };
    }
    if (item.number === parent.number + 1) {
      open[open.length - 1] = { ...item, indent: indentOf(parent) };
      return { item, previous: parent };
    }
    open.push(item);
    return { item, previous: item.number === 1 || item.number === (nestedLast(parent) ?? 0) + 1 ? undefined : parent };
  });
};

/**
 * Each item whose number is not one more than the item it follows. A list that writes one number on every item (「1.」
 * on each, which Markdown counts up) is numbered by the renderer, not by the writer, and is not read. An item numbered 1
 * starts a new count, as the structure rule reads a 1 that follows other items.
 */
export const listNumberBreaks = (items: readonly WrittenNumber[], nestedLast: NestedLast = () => undefined): StructureIssue[] => {
  if (new Set(items.map((item) => item.number)).size < 2) return [];
  return comparedPairs(items, nestedLast).flatMap(({ item, previous }) => {
    if (previous === undefined || item.number === previous.number + 1 || item.number === 1) return [];
    return [{ offset: item.offset, values: { previous: previous.label, label: item.label, expected: previous.number + 1, found: item.number } }];
  });
};

type ListSpans = { readonly span: Span; readonly itemSpans: readonly Span[] };

/** The breaks in the document's lists that are checked; every list, checked or not, tells which ordered list sits inside an item. */
export const listsNumberBreaks = (source: string, lists: readonly ListSpans[], isChecked: (list: ListSpans) => boolean): StructureIssue[] => {
  const nestedLast = nestedLastFinder(
    source,
    lists.map((list) => list.itemSpans),
  );
  return lists.filter(isChecked).flatMap((list) => listNumberBreaks(writtenNumbers(source, list.itemSpans) ?? [], nestedLast));
};
