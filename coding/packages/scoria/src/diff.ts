import type { Report } from "./report.ts";

/**
 * 差分の帰属。scale を線形に固定した理由そのもの（spec §16.2）。
 *
 * 不変条件: ある次元の movers の points の合計は、その次元の delta に一致する。
 * scale に非線形を入れた瞬間にこれは崩れる。設計判断を守るテストとして test_diff.ts が検査する。
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
    .sort((a, b) => a.points - b.points);
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
