import type { Contributor } from "./plugin.ts";

/**
 * Turns raw metric values into points. Linear and clamped, deliberately (spec §16.2).
 *
 * A non-linear curve makes "what is fixing this one thing worth?" unanswerable and stops the
 * delta attribution (movers) from decomposing additively. Explainability is chosen over accuracy.
 */

export type RubricStatus = "experimental" | "stable" | "deprecated";

export interface Scale {
  readonly good: number;
  readonly bad: number;
}

export interface MetricRule {
  readonly metric: string;
  readonly scale: Scale;
  readonly weight: number;
}

export interface Rubric {
  readonly id: string;
  readonly status: RubricStatus;
  readonly metrics: readonly MetricRule[];
  readonly confidenceFrom: readonly string[];
}

/**
 * Why a metric has no value, because the three cases score differently (spec §18.1).
 *
 * A missing value used to become 0, and for a lower-is-better metric 0 is full marks — a directory
 * with no source files scored 100 for readability. The state has to reach the scoring, not just the
 * report.
 */
export type MetricState = { readonly kind: "ok"; readonly value: number } | { readonly kind: "absent" } | { readonly kind: "skipped" };

export type MetricScoreState = "ok" | "absent" | "skipped";

export interface ScoredMetric {
  readonly metric: string;
  readonly value: number;
  readonly state: MetricScoreState;
  readonly scale: Scale;
  readonly weight: number;
  /** Already normalised over the measurable weight, so the points of a dimension sum to its score. */
  readonly points: number;
  readonly topContributors?: readonly Contributor[];
}

export interface ScoredDimension {
  readonly dimension: string;
  readonly status: RubricStatus;
  /** undefined when nothing in the dimension could be measured; never a number standing in for that. */
  readonly score: number | undefined;
  /** Share of the dimension's weight that was actually scored. 1 when everything ran. */
  readonly coverage: number;
  readonly metrics: readonly ScoredMetric[];
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const round = (value: number): number => Number(value.toFixed(4));

/**
 * `good` may be either side of `bad`.
 * A higher-is-better metric such as coverage is written with good > bad.
 */
export const scoreMetric = (value: number, scale: Scale): number => {
  const span = scale.bad - scale.good;
  if (span === 0) return value === scale.good ? 100 : 0;
  return clamp01((scale.bad - value) / span) * 100;
};

/** absent scores zero and keeps its weight; skipped is excluded and the rest renormalised. */
const rawPoints = (state: MetricState, rule: MetricRule): number => (state.kind === "ok" ? scoreMetric(state.value, rule.scale) * rule.weight : 0);

const measurableWeight = (rubric: Rubric, states: ReadonlyMap<string, MetricState>): number =>
  rubric.metrics.filter((rule) => (states.get(rule.metric) ?? { kind: "skipped" }).kind !== "skipped").reduce((sum, rule) => sum + rule.weight, 0);

export const scoreDimension = (rubric: Rubric, states: ReadonlyMap<string, MetricState>): ScoredDimension => {
  const coverage = round(measurableWeight(rubric, states));
  const metrics = rubric.metrics.map((rule) => {
    const state = states.get(rule.metric) ?? { kind: "skipped" as const };
    return {
      metric: rule.metric,
      value: state.kind === "ok" ? state.value : 0,
      state: state.kind,
      scale: rule.scale,
      weight: rule.weight,
      points: coverage === 0 ? 0 : round(rawPoints(state, rule) / coverage),
    };
  });
  const score = coverage === 0 ? undefined : round(metrics.reduce((sum, metric) => sum + metric.points, 0));
  return { dimension: rubric.id, status: rubric.status, score, coverage, metrics };
};
