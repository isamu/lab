import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { findingAt, markupOf } from "./markup-finding.ts";
import { readMarkdown } from "../markdown-read.ts";
import { readLists, type ListMark } from "../list-marks.ts";

/** Fewer lists than this at one depth, and the majority bullet is not yet a habit. */
const MIN_LISTS = 3;

/** Past this share, the document uses both bullets on purpose. */
const MINORITY_PERCENT = 25;

const PERCENT = 100;

/** The length of the bullet quoted: the bullet itself. */
const BULLET_LENGTH = 1;

const at = (doc: ProseDocument, start: number, values: Readonly<Record<string, string | number>>, variant: string): Finding =>
  findingAt(doc, { start, end: start + BULLET_LENGTH }, values, variant);

/** The bullet most lists use; undefined on a tie. */
const majorityOf = (lists: readonly ListMark[]): { readonly mark: string; readonly count: number } | undefined => {
  const counts = [...lists.reduce((acc, list) => acc.set(list.mark, (acc.get(list.mark) ?? 0) + 1), new Map<string, number>())].toSorted(
    ([, left], [, right]) => right - left,
  );
  const [first, second] = counts;
  return first === undefined || second?.[1] === first[1] ? undefined : { mark: first[0], count: first[1] };
};

/** Lists whose bullet differs from the one most lists of the same depth use, while those are the few. */
const minorityAt = (doc: ProseDocument, lists: readonly ListMark[]): Finding[] => {
  const majority = lists.length < MIN_LISTS ? undefined : majorityOf(lists);
  if (majority === undefined) return [];
  const odd = lists.filter((list) => list.mark !== majority.mark);
  if (odd.length * PERCENT > MINORITY_PERCENT * lists.length) return [];
  return odd.map((list) => at(doc, list.start, { mark: list.mark, usual: majority.mark, count: majority.count }, "document"));
};

/** A list written right after another in the same place with another bullet: Markdown starts a new list where the bullet changes. */
const splitAt = (doc: ProseDocument, list: ListMark): Finding[] =>
  list.previous === undefined || list.previous === list.mark ? [] : [at(doc, list.start, { mark: list.mark, usual: list.previous }, "split")];

/**
 * Bullets mixed in one list or one document: a list that changes bullet partway (`-` then `*`, which Markdown splits in two),
 * a `・` line inside a list item (Markdown joins it to the item), and a list whose bullet differs from most lists at its depth.
 */
export const listMarkerMix: Detector = (doc): Finding[] => {
  if (markupOf(doc) === undefined) return [];
  const { lists, foldedTyped } = readLists(doc.source, readMarkdown(doc.source).root);
  const split = lists.flatMap((list) => splitAt(doc, list));
  const folded = foldedTyped.map((start) => at(doc, start, { mark: "・" }, "folded"));
  const reported = new Set(split.map((finding) => finding.values["offset"]));
  const byDepth = new Map<number, ListMark[]>();
  lists.forEach((list) => {
    const same = byDepth.get(list.depth) ?? [];
    same.push(list);
    byDepth.set(list.depth, same);
  });
  const minority = [...byDepth.values()].flatMap((same) => minorityAt(doc, same)).filter((finding) => !reported.has(finding.values["offset"]));
  return [...split, ...folded, ...minority].toSorted((left, right) => Number(left.values["offset"]) - Number(right.values["offset"]));
};
