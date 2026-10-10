import type { LexiconEntry, ProseDocument } from "../plugin.ts";
import type { MeasureUnit } from "./measures.ts";

/**
 * 量の種類ごとの語彙表。weight が基準の単位への倍率で、同じ単位を二度書けば倍率が二つ（GB の 10^9 と 2^30）。
 * group のある語は、語彙表の中の別の種類（mg/dL と mmol/L は換算が物質で違うので、組をまたいで比べない）。
 */
const MEASURE_DIMENSIONS = [
  "unit-length",
  "unit-mass",
  "unit-time",
  "unit-volume",
  "unit-data",
  "unit-temperature",
  "unit-pressure",
  "unit-area",
  "unit-concentration",
] as const;

const dimensionOf = (lexicon: string, entry: LexiconEntry): string => (entry.group === undefined ? lexicon : `${lexicon}:${entry.group}`);

const unitKey = (dimension: string, pattern: string, before: boolean): string => `${dimension}\u0000${before ? "<" : ">"}${pattern}`;

type Factors = { readonly pattern: string; readonly dimension: string; readonly before: boolean; readonly weights: readonly number[] };

/** 単位ごとの、零点（unit-zero）と、要る文脈の語（unit-context の group がその単位の語）。 */
export const measureUnitsOf = (doc: ProseDocument): MeasureUnit[] => {
  const zeros = new Map((doc.lexicons["unit-zero"] ?? []).map((entry) => [entry.pattern, entry.weight ?? 0]));
  const contexts = doc.lexicons["unit-context"] ?? [];
  return MEASURE_DIMENSIONS.flatMap((lexicon) => {
    const factors = new Map<string, Factors>();
    (doc.lexicons[lexicon] ?? []).forEach((entry) => {
      if (entry.weight === undefined) return;
      const before = entry.position === "before";
      const dimension = dimensionOf(lexicon, entry);
      const key = unitKey(dimension, entry.pattern, before);
      const found = factors.get(key) ?? { pattern: entry.pattern, dimension, before, weights: [] };
      factors.set(key, { ...found, weights: [...found.weights, entry.weight] });
    });
    return [...factors.values()].map(({ pattern, dimension, before, weights }) => ({
      pattern,
      dimension,
      factors: weights,
      zero: zeros.get(pattern) ?? 0,
      before,
      context: contexts.filter((entry) => entry.group === pattern).map((entry) => entry.pattern),
    }));
  });
};
