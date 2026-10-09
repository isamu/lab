import type { ProseDocument } from "../plugin.ts";
import type { Mark } from "../structure/time-marks.ts";
import type { CountWord, LimitWords, PeriodCountWords, PeriodWord } from "../derived/period-counts.ts";

// 期間あたりの回数の語（use-count-word）と、語で書いた数（count-number）。product-exceeds-maximum と interval-count-mismatch が読む。

const entriesOf = (doc: ProseDocument, lexicon: string, group?: string) =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group);

export const marksOf = (doc: ProseDocument, lexicon: string, group?: string): Mark[] =>
  entriesOf(doc, lexicon, group).map((entry) => ({ pattern: entry.pattern, position: entry.position, group: entry.group }));

const periodsOf = (doc: ProseDocument): PeriodWord[] =>
  entriesOf(doc, "use-count-word", "period").map((entry) => ({ pattern: entry.pattern, position: entry.position, hours: entry.weight ?? 0 }));

/** one, two, …: the position in count-number is the value. once, twice: the weight in use-count-word. */
const numberWordsOf = (doc: ProseDocument): CountWord[] => [
  ...entriesOf(doc, "count-number").map((entry, index) => ({ pattern: entry.pattern, value: index + 1, alone: false })),
  ...entriesOf(doc, "use-count-word", "alone").map((entry) => ({ pattern: entry.pattern, value: entry.weight ?? 0, alone: true })),
];

export const periodCountWordsOf = (doc: ProseDocument): PeriodCountWords => ({
  periods: periodsOf(doc),
  counters: entriesOf(doc, "use-count-word", "counter").map((entry) => entry.pattern),
  numberWords: numberWordsOf(doc),
});

/** The limit words, the ones that need a negation before them ("more than"), and the negations. */
export const limitWordsOf = (doc: ProseDocument): LimitWords => ({
  limits: [...marksOf(doc, "use-count-word", "limit"), ...marksOf(doc, "use-count-word", "limit-negated")],
  negations: marksOf(doc, "use-count-word", "negation").map((mark) => mark.pattern),
});
