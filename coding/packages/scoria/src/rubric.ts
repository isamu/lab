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

export interface ScoredMetric {
  readonly metric: string;
  readonly value: number;
  readonly scale: Scale;
  readonly weight: number;
  readonly points: number;
}

export interface ScoredDimension {
  readonly dimension: string;
  readonly status: RubricStatus;
  readonly score: number;
  readonly metrics: readonly ScoredMetric[];
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * `good` may be either side of `bad`.
 * A higher-is-better metric such as coverage is written with good > bad.
 */
export const scoreMetric = (value: number, scale: Scale): number => {
  const span = scale.bad - scale.good;
  if (span === 0) return value === scale.good ? 100 : 0;
  return clamp01((scale.bad - value) / span) * 100;
};

const round = (value: number): number => Number(value.toFixed(4));

export const scoreDimension = (rubric: Rubric, values: ReadonlyMap<string, number>): ScoredDimension => {
  const metrics = rubric.metrics.map((rule) => {
    const value = values.get(rule.metric) ?? 0;
    return {
      metric: rule.metric,
      value,
      scale: rule.scale,
      weight: rule.weight,
      points: round(scoreMetric(value, rule.scale) * rule.weight),
    };
  });
  const score = round(metrics.reduce((sum, m) => sum + m.points, 0));
  return { dimension: rubric.id, status: rubric.status, score, metrics };
};
