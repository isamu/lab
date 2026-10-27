// How the items of one bulleted list stand on the page: which items have a blank line after them. Pure; reads the
// source between the items' spans. list-item-form-mix reads from this which items to compare with which.
import type { Span } from "../plugin.ts";

/** Whether the text before the next item ends in a blank line: "item\n\n" or "item\n\n  " but not "item\n". */
const endsInBlankLine = (text: string): boolean => text.split("\n").at(-2)?.trim() === "";

/** Whether a blank line stands between each item and the next. */
const blankAfter = (source: string, spans: readonly Span[]): readonly boolean[] =>
  spans.slice(1).map((next, index) => endsInBlankLine(source.slice(spans[index]?.start ?? next.start, next.start)));

/** Lone items that label a run: one is a lead-in like any other item's, two or more make groups. */
const MIN_GROUP_LABELS = 2;

/** How a list's items stand: the groups to compare within, and the lone items that head a run. */
export type ItemLayout = { readonly groups: readonly (readonly Span[])[]; readonly heads: readonly Span[] };

/**
 * Items standing alone between blank lines before a run of items without them are a nested list a converter flattened
 * (- 家具からの転落, then its steps). With two or more lone items right before a run, each run is a list of its own and the
 * lone items are compared with none; with fewer, the list is one group. heads: every lone item before a run, with only
 * lone items between.
 */
export const itemLayout = (source: string, spans: readonly Span[]): ItemLayout => {
  const blank = blankAfter(source, spans);
  const alone = (index: number): boolean => (index === 0 || blank[index - 1] === true) && blank[index] === true;
  const runAfter = (index: number): readonly Span[] => {
    const end = blank.findIndex((isBlank, gap) => gap > index && isBlank);
    return spans.slice(index + 1, end === -1 ? spans.length : end + 1);
  };
  const runStart = (index: number): number => blank.findIndex((isBlank, gap) => gap > index && !isBlank);
  const headsRun = (index: number): boolean => {
    const start = runStart(index);
    return alone(index) && start !== -1 && spans.slice(index + 1, start).every((_, offset) => alone(index + 1 + offset));
  };
  const labels = spans.flatMap((_, index) => (alone(index) && blank[index + 1] === false ? [index] : []));
  const heads = spans.filter((_, index) => headsRun(index));
  return { groups: labels.length < MIN_GROUP_LABELS ? [spans] : labels.map(runAfter), heads };
};
