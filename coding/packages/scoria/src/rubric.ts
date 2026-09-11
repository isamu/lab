/**
 * metric の生値を点に変換する。線形 + clamp に固定する（spec §16.2）。
 *
 * 非線形なカーブを入れると「この 1 件を直すと何点上がるか」が説明できなくなり、
 * 差分の帰属（movers）も加法的に分解できなくなる。精度より説明可能性を採る判断。
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
 * good と bad はどちらが大きくてもよい。
 * coverage のように「高いほど良い」metric は good > bad で書く。
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
