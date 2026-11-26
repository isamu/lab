/**
 * 値段表の行（PS / CR Femoral Component $550、製品A 5,000円）。品名と値段だけの行が続くとき、品名の中の大文字は製品の型の名前で、
 * 書き手が展開する略語ではない。一行だけの値段（Fee $550）や、句読点のある文の終わりの値段は値段表と読まない。Pure.
 */

type Span = { readonly start: number; readonly end: number };

/** 値段表と読む、続いた行の数の下限。二行なら文の中の値段の並びでもある。 */
const MIN_PRICE_ROWS = 3;

const AMOUNT = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const PRICE = String.raw`(?:[$€£¥￥][ \t]?${AMOUNT}|${AMOUNT}[ \t]?円)`;
/** 頭に記号を付けてよい品名、空白、値段だけの行。品名は文字で始まり、数字と句読点を含まない。 */
const ROW = new RegExp(String.raw`^[ \t]*(?:[-*+•][ \t]+)?\p{L}[^\d$€£¥￥.,;:!?。、]*?[ \t]+${PRICE}[ \t]*$`, "u");

type Line = { readonly text: string; readonly start: number };

const LINE = /^.*$/gmu;

const linesOf = (source: string): Line[] => [...source.matchAll(LINE)].map((match) => ({ text: match[0], start: match.index }));

/** 空行を挟んでよい、値段の行の続き。値段でも空でもない行で切る。 */
const rowRuns = (lines: readonly Line[]): Span[][] =>
  lines.reduce<Span[][]>(
    (runs, line) => {
      if (line.text.trim() === "") return runs;
      if (ROW.test(line.text)) runs.at(-1)?.push({ start: line.start, end: line.start + line.text.length });
      else if (runs.at(-1)?.length !== 0) runs.push([]);
      return runs;
    },
    [[]],
  );

/** 文書の中の、値段表の行の範囲。位置は文書の頭からの文字数。 */
export const priceListSpans = (source: string): Span[] =>
  rowRuns(linesOf(source))
    .filter((run) => run.length >= MIN_PRICE_ROWS)
    .flat();
