import type { ProseDocument } from "../plugin.ts";
import { rangeFrameOf } from "../structure/date-range.ts";
import type { PeriodWords } from "../structure/stated-period.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

/** The words that read a period on a labelled line: the range signs (range-connector, range-opener, range-frame's joint), month and weekday names. */
export const periodWordsOf = (doc: ProseDocument, labels: readonly string[]): PeriodWords => ({
  labels,
  connectors: [
    ...patternsOf(doc, "range-connector"),
    ...patternsOf(doc, "range-opener"),
    ...patternsOf(doc, "range-frame").flatMap((pattern) => rangeFrameOf(pattern)?.joint ?? []),
  ],
  months: patternsOf(doc, "month-name"),
  weekdays: patternsOf(doc, "weekday"),
});
