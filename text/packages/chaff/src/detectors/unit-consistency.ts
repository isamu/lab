import type { Detector, Finding, ProseDocument, StructureNode } from "../plugin.ts";
import { nameSpans } from "../compare/proper-nouns.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";
import { factValues, type FactValue } from "../facts/fact-values.ts";
import { labelledFacts } from "../facts/labelled-facts.ts";
import { tableFacts } from "../facts/table-facts.ts";
import { scopedFacts } from "../facts/fact-scope.ts";
import { measuredValues, type Measured } from "../facts/measures.ts";
import { measureUnitsOf } from "../facts/measure-units.ts";
import { unitConflicts } from "../facts/unit-conflicts.ts";
import { unitPairs } from "../facts/unit-equivalents.ts";
import { itemConflicts } from "../facts/item-amounts.ts";
import { factWordsOf } from "./fact-consistency.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

/** fact-conflict と同じ値に、単位の付いた量を足す。量と重なる値（量の数だけを読んだもの）は量に置き換える。 */
const valuesWith = (tree: StructureNode, doc: ProseDocument, measured: readonly Measured[]): FactValue[] => {
  const taken = spanIndex(measured);
  const others = factValues(tree, doc.source, nameSpans(doc)).filter((value) => !overlapsAny(taken, value));
  return [...others, ...measured].toSorted((left, right) => left.start - right.start);
};

type Mismatch = { readonly label: string; readonly measured: Measured; readonly other: Measured; readonly variant?: string };

/** 同じ範囲の同じ名前の量（「距離：5 km」と「距離：3000 m」）。 */
const labelledMismatches = (doc: ProseDocument, tree: StructureNode, measured: readonly Measured[]): Mismatch[] => {
  const byStart = new Map(measured.map((value) => [value.start, value]));
  const values = valuesWith(tree, doc, measured);
  const facts = [...labelledFacts(doc.source, values, factWordsOf(doc)), ...tableFacts(doc.source, values)];
  const scoped = scopedFacts(facts, tree, doc.source, []);
  return unitConflicts(scoped, (fact) => byStart.get(fact.value.start)).map((conflict) => ({
    label: conflict.fact.label,
    measured: conflict.measured,
    other: conflict.other,
  }));
};

const mismatchesOf = (doc: ProseDocument, tree: StructureNode, measured: readonly Measured[]): Mismatch[] => [
  ...labelledMismatches(doc, tree, measured),
  ...unitPairs(doc.source, measured, patternsOf(doc, "unit-equivalent-hedge")).map((pair) => ({ label: "", ...pair, variant: "bracket" })),
  ...itemConflicts(doc.source, measured, { links: patternsOf(doc, "unit-item-link"), determiners: patternsOf(doc, "fact-label-drop") }).map((conflict) => ({
    label: conflict.name,
    measured: conflict.measured,
    other: conflict.other,
    variant: "item",
  })),
];

const findingOf = (doc: ProseDocument, mismatch: Mismatch): Finding => ({
  rule: "unit-mismatch",
  severity: "warning",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, mismatch.measured.start),
  values: {
    label: mismatch.label,
    value: doc.source.slice(mismatch.measured.start, mismatch.measured.end),
    other: doc.source.slice(mismatch.other.start, mismatch.other.end),
    offset: mismatch.measured.start,
  },
  ...(mismatch.variant === undefined ? {} : { variant: mismatch.variant }),
});

/** 同じ量を、違う単位で書いて、換算すると合わない。一つの量は一度だけ言う。 */
export const unitMismatch: Detector = (doc): Finding[] => {
  const tree = doc.structure;
  if (tree === undefined) return [];
  const measured = measuredValues(doc.source, measureUnitsOf(doc));
  if (measured.length === 0) return [];
  const mismatches = mismatchesOf(doc, tree, measured);
  return mismatches
    .filter((mismatch, index) => mismatches.findIndex((other) => other.measured.start === mismatch.measured.start) === index)
    .map((mismatch) => findingOf(doc, mismatch));
};
