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

const TABLE_RULE = /^[ \t]{0,12}\|?[ \t]{0,4}:?-{3,}/u;
const INDENT = /^[ \t]*/u;

type Line = { readonly start: number; readonly end: number; readonly kind: Kind | undefined; readonly indent: number; readonly rule: boolean };

const kindOf = (text: string): Kind | undefined => {
  if (TABLE_ROW.test(text)) return "table";
  return LIST_ITEM.test(text) ? "list" : undefined;
};

/** 先頭に | を書かない表（「Step | Date」「--- | ---」）の行。| のある見出しの下の区切り行から、| のある行が続くあいだ。 */
const PIPELESS_RULE = /^[ \t]{0,12}:?-{3,}:?[ \t]{0,4}\|/u;

const pipelessTableLines = (texts: readonly string[]): Set<number> => {
  const inTable = new Set<number>();
  texts.forEach((text, index) => {
    if (!PIPELESS_RULE.test(text) || !(texts[index - 1] ?? "").includes("|")) return;
    for (let row = index + 1; row < texts.length && (texts[row] ?? "").includes("|"); row += 1) inTable.add(row);
  });
  return inTable;
};

const linesOf = (source: string): Line[] => {
  const texts = source.split("\n");
  const pipeless = pipelessTableLines(texts);
  const found: Line[] = [];
  let start = 0;
  texts.forEach((text, index) => {
    const indent = INDENT.exec(text)?.[0].length ?? 0;
    const kind = pipeless.has(index) ? "table" : kindOf(text);
    found.push({ start, end: start + text.length, kind, indent, rule: TABLE_RULE.test(text) });
    start += text.length + 1;
  });
  return found;
};

/**
 * 続いた箇条書きや表の中で、同じ深さの行を一つの並びにする。
 * 子の項目（深い字下げ）は親の並びを切らずに、親ごとに別の並びになる。浅い項目が来たら、それより深い並びは閉じる。
 * 表の区切り行（|---|）のすぐ前の行は見出しなので、並びから外す。
 */
const runsOf = (source: string): Line[][] => {
  const runs: Line[][] = [];
  const open = new Map<number, Line[]>();
  const close = (deeperThan: number): void => [...open.keys()].filter((depth) => depth > deeperThan).forEach((depth) => open.delete(depth));
  linesOf(source).forEach((line, index, all) => {
    if (line.kind === undefined || all[index - 1]?.kind !== line.kind) close(-1);
    if (line.kind === undefined) return;
    if (line.rule) {
      open.get(line.indent)?.pop();
      return;
    }
    close(line.indent);
    const run = open.get(line.indent) ?? [];
    if (!open.has(line.indent)) {
      open.set(line.indent, run);
      runs.push(run);
    }
    run.push(line);
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
