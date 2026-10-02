import { FEATURE_IDS, type FeatureId } from "./features.ts";

/** The percentiles kept for each measure: every five from 5 to 95. */
export const BASELINE_STEPS: readonly number[] = Array.from({ length: 19 }, (_, index) => (index + 1) * 5);

const PERCENT = 100;

/** The value at percentile `step` by nearest rank: the smallest value at least `step`% of the documents do not exceed. */
const nearestRank = (sorted: readonly number[], step: number): number => sorted[Math.max(0, Math.ceil((step / PERCENT) * sorted.length) - 1)] ?? 0;

/** A set of values as its percentiles at BASELINE_STEPS, keyed by step. Empty when there are no values. */
export const percentilesOf = (values: readonly number[]): Record<number, number> => {
  if (values.length === 0) return {};
  const sorted = values.toSorted((left, right) => left - right);
  return Object.fromEntries(BASELINE_STEPS.map((step) => [step, nearestRank(sorted, step)]));
};

/** One measure's human distribution: how many documents had a value, and its percentiles. */
export type FeatureBaseline = { readonly measured: number; readonly percentiles: ReadonlyMap<number, number> };

/** One language's baseline: how many articles were read, and each measure's distribution. */
export type LanguageBaseline = { readonly articles: number; readonly features: Readonly<Partial<Record<FeatureId, FeatureBaseline>>> };

export type StructureBaseline = Readonly<Record<string, LanguageBaseline>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const isCount = (value: unknown): value is number => isFiniteNumber(value) && value >= 0;

/** Every step must be one of BASELINE_STEPS with a finite value, or the measure is not compared at all. */
const percentilesFrom = (raw: unknown): ReadonlyMap<number, number> => {
  const entries = Object.entries(isRecord(raw) ? raw : {});
  const read = entries.flatMap(([step, value]) => (BASELINE_STEPS.includes(Number(step)) && isFiniteNumber(value) ? [[Number(step), value] as const] : []));
  return read.length === entries.length ? new Map(read) : new Map();
};

const featureFrom = (raw: unknown): FeatureBaseline | undefined => {
  if (!isRecord(raw) || !isCount(raw["measured"])) return undefined;
  const percentiles = percentilesFrom(raw["percentiles"]);
  return percentiles.size === 0 ? undefined : { measured: raw["measured"], percentiles };
};

const languageFrom = (raw: unknown): LanguageBaseline | undefined => {
  if (!isRecord(raw) || !isCount(raw["articles"]) || !isRecord(raw["features"])) return undefined;
  const features = raw["features"];
  const read = FEATURE_IDS.flatMap((id) => {
    const feature = featureFrom(features[id]);
    return feature === undefined ? [] : [[id, feature] as const];
  });
  return { articles: raw["articles"], features: Object.fromEntries(read) };
};

/** The baseline file as data. A language or a measure that does not parse is left out, and is then reported as not compared. */
export const parseStructureBaseline = (raw: unknown): StructureBaseline =>
  Object.fromEntries(
    Object.entries(isRecord(raw) ? raw : {}).flatMap(([language, value]) => {
      const parsed = languageFrom(value);
      return parsed === undefined ? [] : [[language, parsed] as const];
    }),
  );
