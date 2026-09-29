import type { StructureIssue } from "./issues.ts";
import { runsOf, type Line } from "./runs.ts";

/**
 * 日程として並べた日付の順番。箇条書きの続いた項目か、表の続いた行で、日付をちょうど一つ持つものを並びとして読む。
 * 並びの向き（古い順か新しい順か）は多いほうで決め、それに逆らう一歩だけを言う。新しい順に並べた履歴は正しい並び。
 * 向きが決まらない並び（上がりと下がりが同じ数）は何も言わない。逆らう一歩を言えるのは、日付が 4 つ以上の並びだけになる。
 * 向きに沿って並ぶ日付が半分以下の並びは、日付でなく別のもの（名前、版）で並べた一覧として何も言わない。
 */
export type DatedPoint = { readonly offset: number; readonly value: string };

/** 並びとして比べられる日付の書き方。年月日、年月、月日は、同じ書き方どうしでしか比べない。 */
const PRECISIONS = [/^\d{4}-\d{2}-\d{2}$/u, /^\d{4}-\d{2}$/u, /^\d{2}-\d{2}$/u];

/** 行ごとの日付。ちょうど一つの行だけを並びに入れる。二つある行（期間）はどちらを並べたのか決められない。 */
const datedLines = (run: readonly Line[], points: readonly DatedPoint[]): DatedPoint[] =>
  run.flatMap((line) => {
    const inside = points.filter((point) => point.offset >= line.start && point.offset <= line.end);
    return inside.length === 1 && inside[0] !== undefined ? [inside[0]] : [];
  });

const samePrecision = (dated: readonly DatedPoint[]): boolean => PRECISIONS.some((pattern) => dated.every((point) => pattern.test(point.value)));

/** 上がりが多ければ 1、下がりが多ければ -1、同じ数なら 0（向きを決めない）。 */
const majorityOf = (up: number, down: number): number => Math.sign(up - down);

/** 向きに沿って並べられる日付の最大の数（間を飛ばしてよい。等しい日付は向きに逆らわない）。 */
export const longestInOrder = (values: readonly string[], direction: number): number =>
  Math.max(
    0,
    ...values.reduce<number[]>((lengths, value, index) => {
      const along = values.slice(0, index).map((earlier, at) => (Math.sign(value.localeCompare(earlier)) === -direction ? 0 : (lengths[at] ?? 0)));
      return [...lengths, 1 + Math.max(0, ...along)];
    }, []),
  );

/** 日付のうち向きに沿うものが過半を占める。ひとつふたつの書き間違いなら残りが揃うが、名前順の一覧は揃わない。 */
const mostlyInOrder = (values: readonly string[], direction: number): boolean => longestInOrder(values, direction) * 2 > values.length;

/** 多いほうの向きに逆らう一歩。後ろの項目の日付を指す。 */
const againstMajority = (dated: readonly DatedPoint[]): StructureIssue[] => {
  const steps = dated
    .slice(1)
    .map((point, index) => ({ point, previous: dated[index], sign: Math.sign(point.value.localeCompare(dated[index]?.value ?? "")) }));
  const up = steps.filter((step) => step.sign > 0).length;
  const down = steps.filter((step) => step.sign < 0).length;
  const majority = majorityOf(up, down);
  const values = dated.map((point) => point.value);
  if (majority === 0 || !mostlyInOrder(values, majority)) return [];
  return steps
    .filter((step) => step.sign === -majority)
    .map((step) => ({ offset: step.point.offset, values: { date: step.point.value, previous: step.previous?.value ?? "" } }));
};

export const dateOrderBreaks = (source: string, points: readonly DatedPoint[]): StructureIssue[] =>
  runsOf(source).flatMap((run) => {
    const dated = datedLines(run, points);
    return samePrecision(dated) ? againstMajority(dated) : [];
  });
