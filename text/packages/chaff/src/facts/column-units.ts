import type { Span } from "../plugin.ts";
import { linesOf } from "../structure/lines.ts";
import { cellsOf, tablesOf } from "./table-facts.ts";
import { withoutEdgeMarks } from "./trim-marks.ts";

/**
 * 表の升の値が、列の見出しで何の値か。単価の列（単価、Unit price、時給）の値は数量を掛けて金額になる値で、同じ行の見出しの金額の列
 * （| りんご | 1,200円 |）とは別の量。見出しが単価の列の語（語彙表 unit-price-column）ならその group、group の無い語は UNIT_PRICE。
 * 見出しが何あたりの句（/日、per day、1日あたり）を含めば、その単位。ほかの列の升は IN_FULL（そのままの値）。表の外の値は見出しを
 * 持たないので、どの列の値とも比べる（文の「りんごは120円です」が単価か金額かは、読まないと分からない）。
 */
export type HeadingUnit = { readonly pattern: string; readonly group: string };

export type HeadingUnitWords = {
  /** 単価の列の見出し。見出しの全体がこの語のとき。 */
  readonly headings: readonly HeadingUnit[];
  /** 何あたりの句。見出しのどこかに、語の途中でなく書いたとき。 */
  readonly phrases: readonly HeadingUnit[];
};

/** 単位を言わない単価の列（単価、Unit price）。二つの単価の列どうしは比べ、金額とは比べない。 */
export const UNIT_PRICE = "unit-price";

/** 見出しが何あたりとも言わない列（金額、Amount、料金）。 */
export const IN_FULL = "";

export type ColumnUnit = Span & { readonly column: string };

const LATIN = /[a-z0-9]/iu;

const folded = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

/** 句が text のその位置で、英字の語の途中でない（per day は per days の頭、/h は /hr の頭ではない）。 */
const isWordAt = (text: string, phrase: string, at: number): boolean => {
  const opensWord = LATIN.test(phrase.charAt(0)) && LATIN.test(text.charAt(at - 1));
  const closesWord = LATIN.test(phrase.charAt(phrase.length - 1)) && LATIN.test(text.charAt(at + phrase.length));
  return !opensWord && !closesWord;
};

const occurrences = (text: string, phrase: string, from = 0): number[] => {
  const at = phrase === "" ? -1 : text.indexOf(phrase, from);
  return at === -1 ? [] : [at, ...occurrences(text, phrase, at + 1)];
};

const standsIn = (text: string, phrase: string): boolean => occurrences(text, phrase).some((at) => isWordAt(text, phrase, at));

const longest = (phrases: readonly HeadingUnit[]): HeadingUnit | undefined =>
  phrases.reduce<HeadingUnit | undefined>((best, phrase) => (best === undefined || phrase.pattern.length > best.pattern.length ? phrase : best), undefined);

/** 見出しの言う単位。見出しが単価の列の語ならその group。でなければ見出しに書いた句の単位（二つ当たれば長い句）。どちらも無ければ IN_FULL。 */
export const headingPerUnit = (heading: string, words: HeadingUnitWords): string => {
  const text = folded(withoutEdgeMarks(heading));
  if (text === "") return IN_FULL;
  const named = words.headings.find((word) => folded(word.pattern) === text);
  return named?.group ?? longest(words.phrases.filter((phrase) => standsIn(text, folded(phrase.pattern))))?.group ?? IN_FULL;
};

/** 文書の表すべての本体の升と、その列の見出しの単位。 */
export const columnUnits = (source: string, words: HeadingUnitWords): ColumnUnit[] =>
  tablesOf(linesOf(source)).flatMap((table) => {
    const units = cellsOf(table.header).map((cell) => headingPerUnit(cell.text, words));
    return table.rows.flatMap((row) => cellsOf(row).map((cell, index): ColumnUnit => ({ start: cell.start, end: cell.end, column: units[index] ?? IN_FULL })));
  });

/** 値のある升の列の単位。表の外の値は undefined。 */
export const columnUnitAt = (columns: readonly ColumnUnit[], value: Span): string | undefined =>
  columns.find((column) => value.start >= column.start && value.end <= column.end)?.column;
