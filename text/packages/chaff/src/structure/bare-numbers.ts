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

const bareNumberIn = (source: string, cell: CellSpan): BareNumber[] => {
  const text = source.slice(cell.start, cell.end);
  const before = BEFORE_NUMBER.exec(text)?.[0] ?? "";
  const rest = text.slice(before.length);
  const digits = DIGITS.exec(rest)?.[0] ?? "";
  if (!BARE_NUMBER.test(digits) || !AFTER_NUMBER.test(rest.slice(digits.length))) return [];
  const offset = cell.start + before.length;
  return [{ offset, end: offset + digits.length, value: Number(digits.replace(/,/gu, "")), unit: NO_UNIT }];
};

/** 表の行の、数だけを書いた升。箇条書きの行は読まない。 */
export const bareNumbersIn = (source: string, lines: readonly Line[]): BareNumber[] =>
  lines.filter((line) => line.kind === "table").flatMap((line) => cellsOf(source, line).flatMap((cell) => bareNumberIn(source, cell)));
