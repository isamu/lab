import type { Detector, Finding, ProseDocument, StructureNode } from "../plugin.ts";
import { nameSpans } from "../compare/proper-nouns.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";
import { factValues, type FactValue } from "../facts/fact-values.ts";
import { labelledFacts } from "../facts/labelled-facts.ts";
import { tableFacts } from "../facts/table-facts.ts";
import { scopedFacts } from "../facts/fact-scope.ts";
import { measuredValues, type Measured, type MeasureUnit } from "../facts/measures.ts";
import { unitConflicts } from "../facts/unit-conflicts.ts";
import { factWordsOf } from "./fact-consistency.ts";
import { quoteAt } from "./structure-tree.ts";

/** 量の種類ごとの語彙表。weight が基準の単位への倍率で、同じ単位を二度書けば倍率が二つ（GB の 10^9 と 2^30）。 */
const DIMENSIONS = ["unit-length", "unit-mass", "unit-time", "unit-volume", "unit-data"] as const;

const unitsOf = (doc: ProseDocument): MeasureUnit[] =>
  DIMENSIONS.flatMap((dimension) => {
    const factors = new Map<string, number[]>();
    (doc.lexicons[dimension] ?? []).forEach((entry) => {
      if (entry.weight !== undefined) factors.set(entry.pattern, [...(factors.get(entry.pattern) ?? []), entry.weight]);
    });
    return [...factors.entries()].map(([pattern, weights]) => ({ pattern, dimension, factors: weights }));
  });

/** fact-conflict と同じ値に、単位の付いた量を足す。量と重なる値（量の数だけを読んだもの）は量に置き換える。 */
const valuesWith = (tree: StructureNode, doc: ProseDocument, measured: readonly Measured[]): FactValue[] => {
  const taken = spanIndex(measured);
  const others = factValues(tree, doc.source, nameSpans(doc)).filter((value) => !overlapsAny(taken, value));
  return [...others, ...measured].toSorted((left, right) => left.start - right.start);
};

/** 同じ名前の量を、違う単位で書いて、換算すると合わない。 */
export const unitMismatch: Detector = (doc): Finding[] => {
  const tree = doc.structure;
  if (tree === undefined) return [];
  const measured = measuredValues(doc.source, unitsOf(doc));
  if (measured.length === 0) return [];
  const byStart = new Map(measured.map((value) => [value.start, value]));
  const values = valuesWith(tree, doc, measured);
  const facts = [...labelledFacts(doc.source, values, factWordsOf(doc)), ...tableFacts(doc.source, values)];
  const scoped = scopedFacts(facts, tree, doc.source, []);
  return unitConflicts(scoped, (fact) => byStart.get(fact.value.start)).map((conflict) => ({
    rule: "unit-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, conflict.measured.start),
    values: {
      label: conflict.fact.label,
      value: doc.source.slice(conflict.measured.start, conflict.measured.end),
      other: doc.source.slice(conflict.other.start, conflict.other.end),
      offset: conflict.measured.start,
    },
  }));
};
