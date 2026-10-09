import type { ProseDocument } from "../plugin.ts";
import type { MeasureUnit } from "./measures.ts";

/** 量の種類ごとの語彙表。weight が基準の単位への倍率で、同じ単位を二度書けば倍率が二つ（GB の 10^9 と 2^30）。 */
const MEASURE_DIMENSIONS = ["unit-length", "unit-mass", "unit-time", "unit-volume", "unit-data", "unit-temperature", "unit-pressure", "unit-area"] as const;

const unitKey = (pattern: string, before: boolean): string => `${before ? "<" : ">"}${pattern}`;

/** 単位ごとの、零点（unit-zero）と、要る文脈の語（unit-context の group がその単位の語）。 */
export const measureUnitsOf = (doc: ProseDocument): MeasureUnit[] => {
  const zeros = new Map((doc.lexicons["unit-zero"] ?? []).map((entry) => [entry.pattern, entry.weight ?? 0]));
  const contexts = doc.lexicons["unit-context"] ?? [];
  return MEASURE_DIMENSIONS.flatMap((dimension) => {
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
