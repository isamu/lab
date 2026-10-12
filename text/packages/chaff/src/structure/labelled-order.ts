import { linesOf, type Line } from "./lines.ts";
import { tableAround } from "./key-value-row.ts";
import { isTotalLabel } from "./total.ts";

/**
 * Two labelled points that must come in order: a line (or a list item, or a table's first column) starting with an
 * earlier-side word and one starting with a later-side word, each giving one point. What a point is (a date, a time of
 * day) is the caller's: pointOf reads it off the line, and its value sorts as text. Pure.
 */

/** A point in the text: where it is written, and a value that sorts as text (2026-04-01, a padded count of seconds). */
export type OrderPoint = { readonly offset: number; readonly value: string };

export type PairWords = {
  readonly earlier: readonly string[];
  readonly later: readonly string[];
  /** A line with one of these words reports on a point rather than setting one (期限切れ, overdue) and is not read. */
  readonly passed: readonly string[];
  /** How many lines from the earlier point a later point may be and still be read as the same record's. */
  readonly maxLineGap: number;
};

/** A labelled point: the word that labels it, as the lexicon writes it. span is set when the point ends a stated period. */
export type LabelledPoint = { readonly label: string; readonly point: OrderPoint; readonly line: number; readonly span: boolean };

export type PointPair = { readonly earlier: LabelledPoint; readonly later: LabelledPoint };

/** The point a labelled line gives, or undefined when it gives none. tableOf gives the table the line is a row of. */
export type PointOf = (line: Line, label: string, tableOf: () => readonly string[]) => Pick<LabelledPoint, "point" | "span"> | undefined;

type Read = LabelledPoint & { readonly kind: "earlier" | "later" };

const labelOf = (text: string, words: readonly string[]): string | undefined => words.find((word) => isTotalLabel(text, [word]));

const kindOf = (text: string, words: PairWords): Pick<Read, "kind" | "label"> | undefined => {
  const earlier = labelOf(text, words.earlier);
  if (earlier !== undefined) return { kind: "earlier", label: earlier };
  const later = labelOf(text, words.later);
  return later === undefined ? undefined : { kind: "later", label: later };
};

const labelledPoints = (source: string, words: PairWords, pointOf: PointOf): Read[] => {
  const lines = linesOf(source);
  const texts = lines.map((line) => line.text);
  return lines.flatMap((line, index) => {
    const passed = words.passed.some((word) => line.text.toLowerCase().includes(word.toLowerCase()));
    const kind = passed ? undefined : kindOf(line.text, words);
    const read = kind === undefined ? undefined : pointOf(line, kind.label, () => tableAround(texts, index));
    return kind === undefined || read === undefined ? [] : [{ ...kind, ...read, line: line.number }];
  });
};

/** The earlier point written closest to a later one; of two as close, the one above. */
const nearestEarlier = (earliers: readonly Read[], later: Read): Read | undefined =>
  earliers.reduce<Read | undefined>((nearest, entry) => {
    if (nearest === undefined) return entry;
    const distance = Math.abs(entry.line - later.line);
    const nearestDistance = Math.abs(nearest.line - later.line);
    return distance < nearestDistance || (distance === nearestDistance && entry.line < nearest.line) ? entry : nearest;
  }, undefined);

/**
 * A later point before the first earlier point. When both sides are written more than once (a history listing one record
 * per row, newest first), the later point must also be before the earlier point written closest to it: that is its own
 * record's. A later point written once (an issue date below the records) belongs to the whole document and keeps the first.
 * related drops a pair the caller cannot compare (two times of different days).
 */
export const pointsOutOfOrder = (source: string, words: PairWords, pointOf: PointOf, related: (pair: PointPair) => boolean = () => true): PointPair[] => {
  if (words.earlier.length === 0 || words.later.length === 0) return [];
  const labelled = labelledPoints(source, words, pointOf);
  const earliers = labelled.filter((entry) => entry.kind === "earlier");
  const earlier = earliers[0];
  if (earlier === undefined) return [];
  const records = labelled.filter((entry) => entry.kind === "later").length > 1;
  const beforeOwnRecord = (later: Read): boolean => !records || later.point.value < (nearestEarlier(earliers, later) ?? earlier).point.value;
  return labelled
    .filter(
      (entry) =>
        entry.kind === "later" && entry.point.value < earlier.point.value && Math.abs(entry.line - earlier.line) < words.maxLineGap && beforeOwnRecord(entry),
    )
    .map((later) => ({ earlier, later }))
    .filter(related);
};

/** A lexicon entry naming its pair (group) and its side: before for the earlier point, after for the later one. */
export type OrderLabel = { readonly pattern: string; readonly group?: string | undefined; readonly position?: "before" | "after" | undefined };

/** One pair of a lexicon: the words of its group that label the earlier point, and those that label the later one. */
export type LabelPair = { readonly earlier: string[]; readonly later: string[] };

const sideOf = (labels: readonly OrderLabel[], group: string, position: "before" | "after"): string[] =>
  labels.filter((label) => label.group === group && label.position === position).map((label) => label.pattern);

/** Every pair a lexicon names, in the order its groups first appear. */
export const labelPairsOf = (labels: readonly OrderLabel[]): LabelPair[] =>
  [...new Set(labels.flatMap((label) => (label.group === undefined ? [] : [label.group])))].map((group) => ({
    earlier: sideOf(labels, group, "before"),
    later: sideOf(labels, group, "after"),
  }));
