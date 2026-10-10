import { cellsOf } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { TABLE_ROW } from "./runs.ts";

/**
 * 項目と内容の二列の表で、項目の升に期間の語だけを書いた一行（| 対象期間 | 2026年4月1日〜9月30日 |）。その表で期間の語を項目に書いた行が
 * それ一つのときだけ、内容の升を期間として読む。期間の語の項目が何行も並ぶ表（回ごとの | 期間 | … |）は期間の一覧で、文書の期間ではない。
 * 項目の升が語を含むだけのもの（| Conference room | … |、| 第1期 | … |）は読まない。Pure.
 */
export type ValueCell = { readonly from: number; readonly to: number };

const KEY_VALUE_CELLS = 2;
const TRAILING_COLON = /[:：]$/u;

const cellsOfRow = (row: string): { readonly start: number; readonly end: number; readonly text: string }[] => cellsOf({ text: row, start: 0, number: 0 });

const isLabelCell = (text: string, labels: readonly string[]): boolean => {
  const name = withoutEdgeMarks(withoutEdgeMarks(text).replace(TRAILING_COLON, "")).toLowerCase();
  return labels.some((label) => label.toLowerCase() === name);
};

const isLabelRow = (row: string, labels: readonly string[]): boolean => {
  const first = cellsOfRow(row)[0];
  return TABLE_ROW.test(row) && first !== undefined && isLabelCell(first.text, labels);
};

/** 表の一行の、期間を書いた内容の升（行の中の位置）。tableOf はその行を含む表の全部の行を返す（項目が期間の語の行でだけ呼ぶ）。読まない行は undefined。 */
export const keyValueCell = (row: string, tableOf: () => readonly string[], labels: readonly string[]): ValueCell | undefined => {
  if (!TABLE_ROW.test(row)) return undefined;
  const cells = cellsOfRow(row);
  const [label, value] = cells;
  if (cells.length !== KEY_VALUE_CELLS || label === undefined || value === undefined || !isLabelCell(label.text, labels)) return undefined;
  return tableOf().filter((other) => isLabelRow(other, labels)).length === 1 ? { from: value.start, to: value.end } : undefined;
};

/** index の行を含む、続いた表の行（| で始まる行）。表の行でなければ空。 */
export const tableAround = (rows: readonly string[], index: number): string[] => {
  const isRow = (at: number): boolean => TABLE_ROW.test(rows[at] ?? "");
  if (!isRow(index)) return [];
  let first = index;
  while (isRow(first - 1)) first -= 1;
  let last = index;
  while (isRow(last + 1)) last += 1;
  return rows.slice(first, last + 1);
};
