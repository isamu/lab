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
  readonly from: number | undefined;
  readonly to: number | undefined;
  /** undefined when the two runs did not measure the same thing — see notComparable. */
  readonly delta: number | undefined;
}

export interface ReportDiff {
  readonly dimensions: readonly DimensionDelta[];
  readonly movers: readonly Mover[];
  /** Dimensions whose two runs measured different metric sets, so no change is claimed. */
  readonly notComparable: readonly string[];
}

interface Point {
  readonly value: number;
  readonly points: number;
}

const pointsByMetric = (report: Report, dimension: string): ReadonlyMap<string, Point> => {
  const found = report.dimensions.find((d) => d.dimension === dimension);
  return new Map((found?.metrics ?? []).map((m) => [m.metric, { value: m.value, points: m.points }]));
};

const scoreOf = (report: Report, dimension: string): number | undefined => report.dimensions.find((d) => d.dimension === dimension)?.score;

const metricsOf = (report: Report, dimension: string): ReadonlySet<string> =>
  new Set((report.dimensions.find((d) => d.dimension === dimension)?.metrics ?? []).map((m) => m.metric));

/**
 * Adding a metric to a rubric moves every score in its dimension without a line of the target
 * changing. Subtracting the two numbers anyway credits the release as an improvement: scoria's own
 * `security` dimension read `+100` the first time it existed, and `audit.critical` was reported as
 * the largest single gain at `0 → 0`. Two runs measuring different metrics are not comparable.
 */
const isComparable = (previous: Report, current: Report, dimension: string): boolean => {
  if (scoreOf(previous, dimension) === undefined || scoreOf(current, dimension) === undefined) return false;
  const before = metricsOf(previous, dimension);
  const after = metricsOf(current, dimension);
  return before.size === after.size && [...before].every((metric) => after.has(metric));
};

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

const deltaOf = (previous: Report, current: Report, dimension: string): DimensionDelta => {
  const from = scoreOf(previous, dimension);
  const to = scoreOf(current, dimension);
  const comparable = isComparable(previous, current, dimension);
  return { dimension, from, to, delta: comparable ? round((to ?? 0) - (from ?? 0)) : undefined };
};

export const diffReports = (previous: Report, current: Report): ReportDiff => {
  const names = [...new Set([...previous.dimensions, ...current.dimensions].map((d) => d.dimension))];
  const comparable = names.filter((dimension) => isComparable(previous, current, dimension));
  return {
    dimensions: names.map((dimension) => deltaOf(previous, current, dimension)),
    movers: comparable.flatMap((dimension) => moversOf(previous, current, dimension)),
    notComparable: names.filter((dimension) => !comparable.includes(dimension)),
  };
};
