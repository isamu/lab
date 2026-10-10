import type { Detector, Finding, ProseDocument, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";
import type { DurationUnit } from "../derived/date-arithmetic.ts";
import { hyphenatedCounts } from "../derived/hyphenated-counts.ts";
import { periodPartIssues, tableRowsOf, type PeriodLength, type PeriodPartWords, type PlacedWord } from "../derived/period-parts.ts";
import { DURATION_LEXICONS, quantitiesOf } from "./derived-numbers.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const UNITS: readonly DurationUnit[] = ["day", "week", "month", "year"];
const isDurationUnit = (group: string | undefined): group is DurationUnit => UNITS.some((unit) => unit === group);

/** 期間の単位（か月、months）と、年数にもなる単位（「保証期間は1年」の 年。retention-unit の group が大きさ）。 */
const unitOf = (doc: ProseDocument, unit: string): DurationUnit | undefined => {
  const folded = unit.normalize("NFKC").toLowerCase();
  const listed = DURATION_LEXICONS.find(([id]) => patternsOf(doc, id).some((pattern) => pattern.normalize("NFKC").toLowerCase() === folded))?.[1];
  const extra = (doc.lexicons["retention-unit"] ?? []).find((entry) => entry.pattern.normalize("NFKC") === folded)?.group;
  return listed ?? (isDurationUnit(extra) ? extra : undefined);
};

const datesOf = (tree: StructureNode) => spanIndex(inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [node.span] : [])));

/** 木の数量（12か月、2 years）と名詞の前の期間（a 12-month warranty）。日付の中の数（2026年）は読まない。 */
const lengthsOf = (doc: ProseDocument, tree: StructureNode): PeriodLength[] => {
  const dates = datesOf(tree);
  const hyphenated = hyphenatedCounts(
    doc.source,
    DURATION_LEXICONS.flatMap(([id]) => patternsOf(doc, id)),
  );
  return [...quantitiesOf(tree, doc.source), ...hyphenated]
    .flatMap((quantity): PeriodLength[] => {
      const unit = unitOf(doc, quantity.unit);
      return unit === undefined || overlapsAny(dates, quantity) ? [] : [{ start: quantity.start, end: quantity.end, amount: quantity.amount, unit }];
    })
    .toSorted((left, right) => left.start - right.start);
};

const placed = (doc: ProseDocument, id: string): PlacedWord[] =>
  (doc.lexicons[id] ?? []).map((entry) => ({ pattern: entry.pattern, position: entry.position ?? "before" }));

/** 印、期間の語、後に来る期間の語、長さを言う語、目安と幅の語は語彙表から取る。 */
const wordsOf = (doc: ProseDocument): PeriodPartWords => ({
  markers: (doc.lexicons["period-part-marker"] ?? []).map((entry) => ({ pattern: entry.pattern, position: entry.position ?? "after", group: entry.group })),
  periodWords: patternsOf(doc, "period-part-word"),
  afterWords: patternsOf(doc, "period-part-after"),
  lengthVerbs: patternsOf(doc, "period-part-length-verb"),
  approximate: placed(doc, "approximate-marker"),
  rangeJoiners: patternsOf(doc, "period-part-range"),
  inlineJoiners: patternsOf(doc, "period-part-inline-joiner"),
  unnamed: patternsOf(doc, "period-part-unnamed"),
});

const written = (doc: ProseDocument, span: { start: number; end: number }): string => doc.source.slice(span.start, span.end);

/** 期間の一部として書いた期間が、全体の期間より長い（保証期間（12か月）のうち、無料交換期間は18か月）。 */
export const periodPartExceedsWhole: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const units = [...doc.sentences.map((sentence) => sentence.span), ...tableRowsOf(doc.source)].toSorted((left, right) => left.start - right.start);
  const sectionStarts = (doc.markup?.headings ?? []).map((heading) => heading.start);
  const input = { source: doc.source, units, sectionStarts, lengths: lengthsOf(doc, doc.structure), words: wordsOf(doc) };
  return periodPartIssues(input).map(({ part, whole }) => ({
    rule: "period-part-exceeds-whole",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, part.start),
    values: { part: written(doc, part), whole: written(doc, whole), offset: part.start },
  }));
};
