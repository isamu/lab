import type { Span } from "../plugin.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { TABLE_RULE } from "../structure/runs.ts";
import { CELL_SEPARATOR } from "../structure/bare-numbers.ts";
import type { FactValue } from "./fact-values.ts";
import type { Fact } from "./labelled-facts.ts";
import { withoutEdgeMarks } from "./trim-marks.ts";

/**
 * 表の升の値。名前は行の見出し（最初の列）で、列が三つ以上なら列の見出しも付ける（「大人 料金」）。
 * 升に値だけを書いたときだけ読む。「3,000円（税込）」のように条件を書いた升は読まない。
 * 行の見出しが値を含むか字を含まない表（日付の列から始まる日程表）は、行に名前が無いので読まない。
 */
type Cell = Span & { readonly text: string };

const LETTER = /\p{L}/u;
const TWO_COLUMNS = 2;

const cellsOf = (line: Line): Cell[] => {
  const bounds = [-1, ...[...line.text.matchAll(CELL_SEPARATOR)].map((match) => match.index), line.text.length];
  const cells = bounds.slice(1).map((end, index) => {
    const from = (bounds[index] ?? 0) + 1;
    return { start: line.start + from, end: line.start + end, text: line.text.slice(from, end) };
  });
  const trimmed = line.text.trim();
  return cells.slice(trimmed.startsWith("|") ? 1 : 0, trimmed.endsWith("|") ? cells.length - 1 : cells.length);
};

const plain = withoutEdgeMarks;

/** 区切り行（|---|）の前の行が見出し、後ろに続く | の行が本体。 */
const tablesOf = (lines: readonly Line[]): { header: Line; rows: Line[] }[] =>
  lines.flatMap((line, index) => {
    const header = lines[index - 1];
    if (!TABLE_RULE.test(line.text) || header === undefined || !header.text.includes("|")) return [];
    const after = lines.slice(index + 1);
    const end = after.findIndex((row) => !row.text.includes("|"));
    return [{ header, rows: end === -1 ? after : after.slice(0, end) }];
  });

const inside = (cell: Span, value: FactValue): boolean => value.start >= cell.start && value.end <= cell.end;

/** 升の値。升の字（強調を除く）がちょうど一つの値のときだけ。 */
const cellValue = (cell: Cell, values: readonly FactValue[], source: string): FactValue | undefined => {
  const within = values.filter((value) => inside(cell, value));
  const only = within.length === 1 ? within[0] : undefined;
  return only !== undefined && source.slice(only.start, only.end) === plain(cell.text) ? only : undefined;
};

const keyOf = (label: string): string => label.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ");

const rowFacts = (row: Line, headings: readonly string[], values: readonly FactValue[], source: string): Fact[] => {
  const [first, ...rest] = cellsOf(row);
  if (first === undefined) return [];
  const rowLabel = plain(first.text);
  if (!LETTER.test(rowLabel) || values.some((value) => inside(first, value))) return [];
  return rest.flatMap((cell, index) => {
    const value = cellValue(cell, values, source);
    const column = headings[index + 1] ?? "";
    if (value === undefined || (headings.length > TWO_COLUMNS && column === "")) return [];
    const label = headings.length > TWO_COLUMNS ? `${rowLabel} ${column}` : rowLabel;
    return [{ label, key: keyOf(label), value }];
  });
};

/** 文書の表すべての升の値。 */
export const tableFacts = (source: string, values: readonly FactValue[]): Fact[] =>
  tablesOf(linesOf(source)).flatMap((table) => {
    const headings = cellsOf(table.header).map((cell) => plain(cell.text));
    return table.rows.flatMap((row) => rowFacts(row, headings, values, source));
  });
