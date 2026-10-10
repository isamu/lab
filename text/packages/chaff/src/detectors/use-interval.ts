import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";
import { intervalCountMismatches, type IntervalMismatch, type IntervalWords } from "../derived/use-interval.ts";
import { paragraphsOf } from "../derived/period-counts.ts";
import { timeLengths, type TimeLength } from "../derived/time-lengths.ts";
import { limitWordsOf, marksOf, periodCountWordsOf } from "./use-count-words.ts";
import { quoteAt } from "./structure-tree.ts";

// 使う間隔の下限と期間あたりの回数の上限が両立しない、または表の回数と合わない（interval-count-mismatch）。
// 語は use-count-word と use-interval-word、長さの単位は unit-time から取る。

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

const patternsOf = (doc: ProseDocument, lexicon: string, weight?: number): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => weight === undefined || entry.weight === weight).map((entry) => entry.pattern);

const lengthsOf = (doc: ProseDocument): TimeLength[] =>
  timeLengths(doc.source, {
    hourUnits: patternsOf(doc, "unit-time", SECONDS_PER_HOUR),
    minuteUnits: patternsOf(doc, "unit-time", SECONDS_PER_MINUTE),
    halves: patternsOf(doc, "length-half"),
    numberWords: patternsOf(doc, "count-number"),
  });

const wordsOf = (doc: ProseDocument): IntervalWords => ({
  ...periodCountWordsOf(doc),
  ...limitWordsOf(doc),
  minimum: marksOf(doc, "use-interval-word", "minimum"),
  cues: marksOf(doc, "use-interval-word", "cue").map((mark) => mark.pattern),
  columns: (doc.lexicons["use-interval-word"] ?? [])
    .filter((entry) => entry.group === "column")
    .map((entry) => ({ pattern: entry.pattern, hours: entry.weight ?? 0 })),
});

const written = (doc: ProseDocument, span: Span): string => doc.source.slice(span.start, span.end);

const valuesOf = (doc: ProseDocument, mismatch: IntervalMismatch): Record<string, string | number> =>
  mismatch.kind === "interval"
    ? { count: written(doc, mismatch.count), interval: written(doc, mismatch.interval), needed: mismatch.neededHours, hours: mismatch.count.hours }
    : { count: written(doc, mismatch.count), column: mismatch.column, table: mismatch.tableCount };

export const intervalCountMismatch: Detector = (doc): Finding[] =>
  intervalCountMismatches(doc.source, paragraphsOf(doc.source), lengthsOf(doc), wordsOf(doc)).map((mismatch) => ({
    rule: "interval-count-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, mismatch.count.start),
    values: { ...valuesOf(doc, mismatch), offset: mismatch.count.start },
    ...(mismatch.kind === "table" ? { variant: "table" } : {}),
  }));
