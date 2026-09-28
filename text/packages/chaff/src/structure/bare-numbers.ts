import type { Line } from "./runs.ts";

/** 単位を書かない数。単位は表の列の見出しにあるか、無い。木の数量は必ず単位を持つので、空の単位とは重ならない。 */
export const NO_UNIT = "";

export type BareNumber = { readonly offset: number; readonly end: number; readonly value: number; readonly unit: typeof NO_UNIT };

/**
 * 表の升に数だけを書いたもの（1,205、12.5、-50、▲50、**1,205**）。前の印と強調は数に入れない。
 * 0 で始まる番号（007）、区切りの崩れた 1,20、括弧の (50)、注の付いた 1,205a は数にしない。
 */
const BARE_NUMBER = /^(?:[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d*|0)(?:\.\d+)?$/u;

/** 数の前の空白、強調、負の印（-、▲）と、数の後ろの強調と空白。 */
const BEFORE_NUMBER = /^[ \t]*[*_]*(?:[-−▲△][ \t]?)?/u;
const AFTER_NUMBER = /^[*_]*\s*$/u;
const DIGITS = /^[\d,.]*/u;

/** 表の列の区切り。\| は列の中に書いた | なので数えない。 */
export const CELL_SEPARATOR = /(?<!\\)\|/gu;

type CellSpan = { readonly start: number; readonly end: number };

const cellsOf = (source: string, line: Line): CellSpan[] => {
  const text = source.slice(line.start, line.end);
  const bounds = [-1, ...[...text.matchAll(CELL_SEPARATOR)].map((match) => match.index), text.length];
  return bounds.slice(1).map((end, index) => ({ start: line.start + (bounds[index] ?? 0) + 1, end: line.start + end }));
};

type InColumn = BareNumber & { readonly column: number; readonly digits: string };

const bareNumberIn = (source: string, cell: CellSpan, column: number): InColumn[] => {
  const text = source.slice(cell.start, cell.end);
  const before = BEFORE_NUMBER.exec(text)?.[0] ?? "";
  const rest = text.slice(before.length);
  const digits = DIGITS.exec(rest)?.[0] ?? "";
  if (!BARE_NUMBER.test(digits) || !AFTER_NUMBER.test(rest.slice(digits.length))) return [];
  const offset = cell.start + before.length;
  return [{ offset, end: offset + digits.length, value: Number(digits.replace(/,/gu, "")), unit: NO_UNIT, column, digits }];
};

/** 表の見出し。最初の行の上の区切り行（|---|）の、さらに上の行。 */
const headerAbove = (source: string, firstRow: Line | undefined): string => {
  if (firstRow === undefined || firstRow.start < 2) return "";
  const ruleStart = source.lastIndexOf("\n", firstRow.start - 2) + 1;
  if (ruleStart < 2) return "";
  return source.slice(source.lastIndexOf("\n", ruleStart - 2) + 1, ruleStart - 1);
};

/** 見出しに % のある列は率。 */
const PERCENT = /[%％]/u;

/** 同じ桁数で 4 桁以上の、区切りの無い整数だけの列は、年か番号（2024、1041）。 */
const YEAR_OR_CODE = /^\d{4,}$/u;

const isYearsOrCodes = (numbers: readonly InColumn[]): boolean =>
  numbers.every((number) => YEAR_OR_CODE.test(number.digits) && number.digits.length === numbers[0]?.digits.length);

/** 足してよい列か。見出しが率を言う列と、年や番号の列は足さない。 */
const isAmountColumn = (header: string, numbers: readonly InColumn[], column: number): boolean =>
  !PERCENT.test(header.split(CELL_SEPARATOR)[column] ?? "") && !isYearsOrCodes(numbers);

/** 表の行の、数だけを書いた升。箇条書きの行は読まない。 */
export const bareNumbersIn = (source: string, lines: readonly Line[]): BareNumber[] => {
  const rows = lines.filter((line) => line.kind === "table");
  const found = rows.flatMap((line) => cellsOf(source, line).flatMap((cell, column) => bareNumberIn(source, cell, column)));
  const header = headerAbove(source, rows[0]);
  const amountColumns = new Set(
    [...new Set(found.map((number) => number.column))].filter((column) =>
      isAmountColumn(
        header,
        found.filter((number) => number.column === column),
        column,
      ),
    ),
  );
  return found.filter((number) => amountColumns.has(number.column)).map(({ offset, end, value, unit }) => ({ offset, end, value, unit }));
};
