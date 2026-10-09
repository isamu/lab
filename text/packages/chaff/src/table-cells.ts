import type { ProseDocument, Segmentation, Span, TableCell, Token } from "./plugin.ts";
import { proseAndTablesOf } from "./table-text.ts";
import { tableBodyCells, type Cell } from "./facts/table-facts.ts";

// 表の升の語。本文は表を覆うので、升の字は文の分割も品詞解析も通らない。升ごとに adapter に渡し、語の位置を source の上に戻す。

const LETTER = /\p{L}/u;

const shiftToken = (token: Token, by: number): Token => ({ ...token, span: { start: token.span.start + by, end: token.span.end + by } });

/** 升一つの語。字の無い升（数だけ、空）は解析しない。adapter が語を返さなければ tokens は無い。 */
export const cellWithTokens = (cell: Cell, segment: (text: string) => Segmentation): TableCell => {
  if (!LETTER.test(cell.text)) return cell;
  const sentences = segment(cell.text).sentences;
  if (!sentences.some((sentence) => sentence.tokens !== undefined)) return cell;
  return { ...cell, tokens: sentences.flatMap((sentence) => (sentence.tokens ?? []).map((token) => shiftToken(token, cell.start))) };
};

/** 文書の表（引用とコードの外）の本体の升と、その語。 */
export const tableCellsOf = (doc: ProseDocument, segment: (text: string) => Segmentation): TableCell[] =>
  tableBodyCells(proseAndTablesOf(doc)).map((cell) => cellWithTokens(cell, segment));

/** prose に、升の字だけを書き戻したもの（表の見出しの行と区切りの | は覆ったまま）。位置は変えない。 */
export const proseWithCells = (prose: string, cells: readonly (Span & { readonly text: string })[]): string => {
  const pieces: string[] = [];
  const end = cells
    .toSorted((left, right) => left.start - right.start)
    .reduce((from, cell) => {
      if (cell.start < from || cell.end - cell.start !== cell.text.length) return from;
      pieces.push(prose.slice(from, cell.start), cell.text);
      return cell.end;
    }, 0);
  pieces.push(prose.slice(end));
  return pieces.join("");
};

/** 表の升の語は、読む rule があるときに一度だけ作る。升ごとの解析を、表を読まない rule に払わせない。 */
export const lazyCells = (make: () => readonly TableCell[]): (() => readonly TableCell[]) => {
  const cells: { value?: readonly TableCell[] } = {};
  return () => (cells.value ??= make());
};
