import type { Report } from "./report.ts";

/**
 * Delta attribution — the whole reason the scale is kept linear (spec §16.2).
 *
 * Invariant: for any dimension, the points of its movers sum to that dimension's delta.
 * Introducing a non-linear scale breaks it immediately, which is why test_diff.ts pins it.
 */

export interface Mover {
  readonly dimension: string;
  readonly metric: string;
  readonly from: number;
  readonly to: number;
  readonly points: number;
}

export interface DimensionDelta {
  readonly dimension: string;
  readonly from: number;
  readonly to: number;
  readonly delta: number;
}

export interface ReportDiff {
  readonly dimensions: readonly DimensionDelta[];
  readonly movers: readonly Mover[];
}

interface Point {
  readonly value: number;
  readonly points: number;
}

const pointsByMetric = (report: Report, dimension: string): ReadonlyMap<string, Point> => {
  const found = report.dimensions.find((d) => d.dimension === dimension);
  return new Map((found?.metrics ?? []).map((m) => [m.metric, { value: m.value, points: m.points }]));
};

const scoreOf = (report: Report, dimension: string): number => report.dimensions.find((d) => d.dimension === dimension)?.score ?? 0;

const round = (value: number): number => Number(value.toFixed(4));

const moversOf = (previous: Report, current: Report, dimension: string): readonly Mover[] => {
  const before = pointsByMetric(previous, dimension);
  const after = pointsByMetric(current, dimension);
  const metrics = [...new Set([...before.keys(), ...after.keys()])];
  return metrics
    .map((metric) => {
      const from = before.get(metric);
      const to = after.get(metric);
      return {
        dimension,
        metric,
        from: from?.value ?? 0,
        to: to?.value ?? 0,
        points: round((to?.points ?? 0) - (from?.points ?? 0)),
      };
    })
    .filter((mover) => mover.points !== 0)
    .toSorted((a, b) => a.points - b.points);
};

export const diffReports = (previous: Report, current: Report): ReportDiff => {
  const names = [...new Set([...previous.dimensions, ...current.dimensions].map((d) => d.dimension))];
  return {
    dimensions: names.map((dimension) => ({
      dimension,
      from: scoreOf(previous, dimension),
      to: scoreOf(current, dimension),
      delta: round(scoreOf(current, dimension) - scoreOf(previous, dimension)),
    })),
    movers: names.flatMap((dimension) => moversOf(previous, current, dimension)),
  };
};
