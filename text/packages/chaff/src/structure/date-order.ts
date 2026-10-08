import type { StructureIssue } from "./issues.ts";
import { runsOf } from "./runs.ts";

/**
 * 日程として並べた日付の順番。箇条書きの続いた項目、表の続いた行、同じ親の下で同じ深さに並ぶ見出しで、
 * 日付をちょうど一つ持つものを並びとして読む。
 * 並びの向き（古い順か新しい順か）は多いほうで決め、それに逆らう一歩ごとに、その前後のうち並びから外れた日付を言う。新しい順に並べた履歴は正しい並び。
 * 向きが決まらない並び（上がりと下がりが同じ数）は何も言わない。逆らう一歩を言えるのは、日付が 4 つ以上の並びだけになる。
 * 向きに沿って並ぶ日付が半分以下の並びは、日付でなく別のもの（名前、版）で並べた一覧として何も言わない。
 */
export type DatedPoint = { readonly offset: number; readonly value: string };

/** 並びとして比べられる日付の書き方。年月日、年月、月日は、同じ書き方どうしでしか比べない。 */
const PRECISIONS = [/^\d{4}-\d{2}-\d{2}$/u, /^\d{4}-\d{2}$/u, /^\d{2}-\d{2}$/u];

/** 並びの一行（箇条書きの項目、表の行、見出し）の原文の範囲。 */
type Span = { readonly start: number; readonly end: number };

/** 見出しの深さと原文の範囲。 */
export type HeadingSpan = Span & { readonly depth: number };

/**
 * 同じ親の下で同じ深さに並ぶ見出し（変更履歴の版ごとの見出し）。浅い見出しが来たら、それより深い並びは閉じる。
 * 深い見出し（### 追加）は並びを切らず、親ごとに別の並びになる。
 */
export const siblingHeadingRuns = (headings: readonly HeadingSpan[]): HeadingSpan[][] => {
  const runs: HeadingSpan[][] = [];
  const open = new Map<number, HeadingSpan[]>();
  headings.forEach((heading) => {
    [...open.keys()].filter((depth) => depth > heading.depth).forEach((depth) => open.delete(depth));
    const run = open.get(heading.depth) ?? [];
    if (!open.has(heading.depth)) {
      open.set(heading.depth, run);
      runs.push(run);
    }
    run.push(heading);
  });
  return runs;
};

/** 一行のただ一つの日付。二つある行（期間）はどちらを並べたのか決められないので、並びに入れない。 */
const onlyDateIn = (line: Span, points: readonly DatedPoint[]): DatedPoint | undefined => {
  const inside = points.filter((point) => point.offset >= line.start && point.offset <= line.end);
  return inside.length === 1 ? inside[0] : undefined;
};

const datedLines = (run: readonly Span[], points: readonly DatedPoint[]): DatedPoint[] =>
  run.flatMap((line) => {
    const date = onlyDateIn(line, points);
    return date === undefined ? [] : [date];
  });

/** 見出しの並びは、日付を一つ持つ見出しが続くあいだだけ。日付の無い見出しが混じる並び（問いに更新日を添えた FAQ）は、日付で並べたものではない。 */
const datedStretches = (run: readonly Span[], points: readonly DatedPoint[]): DatedPoint[][] =>
  run.reduce<DatedPoint[][]>(
    (stretches, heading) => {
      const date = onlyDateIn(heading, points);
      if (date === undefined) return [...stretches, []];
      return [...stretches.slice(0, -1), [...(stretches.at(-1) ?? []), date]];
    },
    [[]],
  );

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

const without = (values: readonly string[], index: number): string[] => values.filter((_, at) => at !== index);

/**
 * 向きに逆らう一歩（at - 1 から at）のうち、並びから外れているほう。取り除いたとき残りが長く揃うほうを指す。
 * 前を取っても後ろを取っても同じだけ揃う（隣どうしの入れ替わり）なら、どちらとも決められないので後ろを指す。
 * 先頭の日付は指さない。言葉が「前は〜」と前の日付を添えるので、前の無い日付には言えない。
 */
export const outOfPlace = (values: readonly string[], at: number, direction: number): number =>
  at >= 2 && longestInOrder(without(values, at - 1), direction) > longestInOrder(without(values, at), direction) ? at - 1 : at;

/** 多いほうの向きに逆らう一歩ごとに、並びから外れた日付を指す。 */
const againstMajority = (dated: readonly DatedPoint[]): StructureIssue[] => {
  const values = dated.map((point) => point.value);
  const signs = values.slice(1).map((value, index) => Math.sign(value.localeCompare(values[index] ?? "")));
  const majority = majorityOf(signs.filter((sign) => sign > 0).length, signs.filter((sign) => sign < 0).length);
  if (majority === 0 || !mostlyInOrder(values, majority)) return [];
  return signs.flatMap((sign, index) => {
    if (sign !== -majority) return [];
    const at = outOfPlace(values, index + 1, majority);
    const point = dated[at];
    return point === undefined ? [] : [{ offset: point.offset, values: { date: point.value, previous: dated[at - 1]?.value ?? "" } }];
  });
};

const breaksIn = (dated: readonly DatedPoint[]): StructureIssue[] => (samePrecision(dated) ? againstMajority(dated) : []);

/** 見出しを箇条書きの中に書けば（「- ## 3.1.0 - 2026-10-02」）、同じ日付が両方の並びに入る。一度だけ言う。 */
const oncePerOffset = (issues: readonly StructureIssue[]): StructureIssue[] =>
  issues.filter((issue, index) => issues.findIndex((other) => other.offset === issue.offset) === index);

export const dateOrderBreaks = (source: string, points: readonly DatedPoint[], headings: readonly HeadingSpan[] = []): StructureIssue[] =>
  oncePerOffset([
    ...runsOf(source).flatMap((run) => breaksIn(datedLines(run, points))),
    ...siblingHeadingRuns(headings).flatMap((run) => datedStretches(run, points).flatMap(breaksIn)),
  ]);
