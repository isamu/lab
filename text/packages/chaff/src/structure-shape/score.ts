import { DIRECTION, type Direction, type FeatureValue } from "./features.ts";
import type { FeatureBaseline, LanguageBaseline } from "./baseline.ts";

/** A high measure counts past this percentile of human articles; a low one (uniform sections) below 100 minus it. */
export const BEYOND_STEP = 90;
const MEDIAN_STEP = 50;
const ALL = 100;

/** One measure set against the human articles. */
export type Placement = {
  readonly feature: FeatureValue;
  readonly direction: Direction;
  /** Roughly what share of human articles the value is past, away from human writing (0 when it is not past any). */
  readonly pastShare: number | undefined;
  /** The value past which the measure counts: the human p90, or p10 for a low measure. */
  readonly limit: number | undefined;
  readonly median: number | undefined;
  /** Whether the value is past the limit: one point of the structure score. */
  readonly beyond: boolean;
};

/** The structure score: how many measures are past the human p90, out of how many could be compared. */
export type StructureScore = {
  readonly placements: readonly Placement[];
  readonly score: number;
  readonly compared: number;
  /** How many human articles the baseline read, or undefined when there is no baseline for the language. */
  readonly articles: number | undefined;
};

const stepsOf = (baseline: FeatureBaseline): [number, number][] => [...baseline.percentiles.entries()].toSorted((left, right) => left[0] - right[0]);

/** For a high measure: the highest step whose value is below this one. For a low one: the share whose value is above it. */
export const pastShareOf = (value: number, baseline: FeatureBaseline, direction: Direction): number => {
  const steps = stepsOf(baseline);
  if (direction === "high") return steps.findLast(([, at]) => at < value)?.[0] ?? 0;
  const above = steps.find(([, at]) => at > value)?.[0];
  return above === undefined ? 0 : ALL - above;
};

const limitStep = (direction: Direction): number => (direction === "high" ? BEYOND_STEP : ALL - BEYOND_STEP);

export const isBeyond = (value: number, limit: number, direction: Direction): boolean => (direction === "high" ? value > limit : value < limit);

const placementOf = (feature: FeatureValue, baseline: FeatureBaseline | undefined): Placement => {
  const direction = DIRECTION[feature.id];
  const limit = baseline?.percentiles.get(limitStep(direction));
  const median = baseline?.percentiles.get(MEDIAN_STEP);
  if (feature.value === undefined || baseline === undefined || limit === undefined) {
    return { feature, direction, pastShare: undefined, limit, median, beyond: false };
  }
  const beyond = isBeyond(feature.value, limit, direction);
  return { feature, direction, pastShare: pastShareOf(feature.value, baseline, direction), limit, median, beyond };
};

/** Each measure placed against the language's human baseline, and the count of those past the human p90. Never an opaque number. */
export const structureScoreOf = (features: readonly FeatureValue[], baseline: LanguageBaseline | undefined): StructureScore => {
  const placements = features.map((feature) => placementOf(feature, baseline?.features[feature.id]));
  return {
    placements,
    score: placements.filter((placement) => placement.beyond).length,
    compared: placements.filter((placement) => placement.pastShare !== undefined).length,
    articles: baseline?.articles,
  };
};
