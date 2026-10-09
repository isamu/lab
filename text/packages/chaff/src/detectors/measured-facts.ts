import type { ProseDocument, StructureNode } from "../plugin.ts";
import { nameSpans } from "../compare/proper-nouns.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";
import { factValues, type FactValue } from "../facts/fact-values.ts";
import { codeFences } from "./code-fences.ts";
import { measuredValues, type Measured, type MeasureUnit } from "../facts/measures.ts";

/** 量の種類ごとの語彙表。weight が基準の単位への倍率で、同じ単位を二度書けば倍率が二つ（GB の 10^9 と 2^30）。 */
const DIMENSIONS = ["unit-length", "unit-mass", "unit-time", "unit-volume", "unit-data", "unit-temperature", "unit-pressure"] as const;

const unitKey = (pattern: string, before: boolean): string => `${before ? "<" : ">"}${pattern}`;

/** 単位ごとの、零点（unit-zero）と、要る文脈の語（unit-context の group がその単位の語）。 */
const unitsOf = (doc: ProseDocument): MeasureUnit[] => {
  const zeros = new Map((doc.lexicons["unit-zero"] ?? []).map((entry) => [entry.pattern, entry.weight ?? 0]));
  const contexts = doc.lexicons["unit-context"] ?? [];
  return DIMENSIONS.flatMap((dimension) => {
    const factors = new Map<string, { pattern: string; before: boolean; weights: number[] }>();
    (doc.lexicons[dimension] ?? []).forEach((entry) => {
      if (entry.weight === undefined) return;
      const before = entry.position === "before";
      const key = unitKey(entry.pattern, before);
      const found = factors.get(key) ?? { pattern: entry.pattern, before, weights: [] };
      factors.set(key, { ...found, weights: [...found.weights, entry.weight] });
    });
    return [...factors.values()].map(({ pattern, before, weights }) => ({
      pattern,
      dimension,
      factors: weights,
      zero: zeros.get(pattern) ?? 0,
      before,
      context: contexts.filter((entry) => entry.group === pattern).map((entry) => entry.pattern),
    }));
  });
};

/** 文書の中の、単位の語彙表の単位が付いた量。コードの塊の中の量は、項目の値ではない。 */
export const measuredOf = (doc: ProseDocument): Measured[] => {
  const fences = codeFences(doc.source);
  return measuredValues(doc.source, unitsOf(doc)).filter((value) => !fences.some((fence) => fence.start <= value.start && value.end <= fence.end));
};

/** fact-conflict の値に、単位の付いた量を足す。量と重なる値（量の数だけを読んだもの）は量に置き換える。 */
export const valuesWith = (tree: StructureNode, doc: ProseDocument, measured: readonly Measured[]): FactValue[] => {
  const taken = spanIndex(measured);
  const others = factValues(tree, doc.source, nameSpans(doc)).filter((value) => !overlapsAny(taken, value));
  return [...others, ...measured].toSorted((left, right) => left.start - right.start);
};
