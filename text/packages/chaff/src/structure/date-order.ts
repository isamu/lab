import type { StructureIssue } from "./issues.ts";

/**
 * 日程として並べた日付の順番。箇条書きの続いた項目か、表の続いた行で、日付をちょうど一つ持つものを並びとして読む。
 * 並びの向き（古い順か新しい順か）は多いほうで決め、それに逆らう一歩だけを言う。新しい順に並べた履歴は正しい並び。
 * 向きが決まらない並び（上がりと下がりが同じ数）は何も言わない。逆らう一歩を言えるのは、日付が 4 つ以上の並びだけになる。
 */
export type DatedPoint = { readonly offset: number; readonly value: string };

type Kind = "list" | "table";

const LIST_ITEM = /^[ \t]{0,12}(?:[-*+]|\d{1,3}[.)])[ \t]/u;
const TABLE_ROW = /^[ \t]{0,12}\|/u;

/** 並びとして比べられる日付の書き方。年月日、年月、月日は、同じ書き方どうしでしか比べない。 */
const PRECISIONS = [/^\d{4}-\d{2}-\d{2}$/u, /^\d{4}-\d{2}$/u, /^\d{2}-\d{2}$/u];

type Line = { readonly start: number; readonly end: number; readonly kind: Kind | undefined };

const kindOf = (text: string): Kind | undefined => {
  if (TABLE_ROW.test(text)) return "table";
  return LIST_ITEM.test(text) ? "list" : undefined;
};

const linesOf = (source: string): Line[] => {
  const found: Line[] = [];
  let start = 0;
  source.split("\n").forEach((text) => {
    found.push({ start, end: start + text.length, kind: kindOf(text) });
    start += text.length + 1;
  });
  return found;
};

/** 同じ種類の行が続くところ。表の区切り行（|---|）も表の行で、日付を持たないので並びには入らない。 */
const runsOf = (source: string): Line[][] => {
  const runs: Line[][] = [];
  linesOf(source).forEach((line, index, all) => {
    const continues = line.kind !== undefined && all[index - 1]?.kind === line.kind;
    if (line.kind === undefined) return;
    if (continues && runs.length > 0) runs.at(-1)?.push(line);
    else runs.push([line]);
  });
  return runs;
};

/** 行ごとの日付。ちょうど一つの行だけを並びに入れる。二つある行（期間）はどちらを並べたのか決められない。 */
const datedLines = (run: readonly Line[], points: readonly DatedPoint[]): DatedPoint[] =>
  run.flatMap((line) => {
    const inside = points.filter((point) => point.offset >= line.start && point.offset <= line.end);
    return inside.length === 1 && inside[0] !== undefined ? [inside[0]] : [];
  });

const samePrecision = (dated: readonly DatedPoint[]): boolean => PRECISIONS.some((pattern) => dated.every((point) => pattern.test(point.value)));

/** 上がりが多ければ 1、下がりが多ければ -1、同じ数なら 0（向きを決めない）。 */
const majorityOf = (up: number, down: number): number => Math.sign(up - down);

/** 多いほうの向きに逆らう一歩。後ろの項目の日付を指す。 */
const againstMajority = (dated: readonly DatedPoint[]): StructureIssue[] => {
  const steps = dated
    .slice(1)
    .map((point, index) => ({ point, previous: dated[index], sign: Math.sign(point.value.localeCompare(dated[index]?.value ?? "")) }));
  const up = steps.filter((step) => step.sign > 0).length;
  const down = steps.filter((step) => step.sign < 0).length;
  const majority = majorityOf(up, down);
  if (majority === 0) return [];
  return steps
    .filter((step) => step.sign === -majority)
    .map((step) => ({ offset: step.point.offset, values: { date: step.point.value, previous: step.previous?.value ?? "" } }));
};

export const dateOrderBreaks = (source: string, points: readonly DatedPoint[]): StructureIssue[] =>
  runsOf(source).flatMap((run) => {
    const dated = datedLines(run, points);
    return samePrecision(dated) ? againstMajority(dated) : [];
  });
