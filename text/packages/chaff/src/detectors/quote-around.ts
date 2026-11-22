import type { Sentence } from "../plugin.ts";

/** 見せる前後の字数。記号 1 つの指摘は、周りの言葉が無いとどこか分からない。 */
const QUOTE_REACH = 20;

type LineSpan = { readonly start: number; readonly end: number };

const lineAt = (text: string, at: number): LineSpan => {
  const end = text.indexOf("\n", at);
  // lastIndexOf reads a negative position as 0, and would find a line break at the very start.
  return { start: at <= 0 ? 0 : text.lastIndexOf("\n", at - 1) + 1, end: end === -1 ? text.length : end };
};

const TABLE_ROW = /^[ \t]*\|/u;

const isTableRow = (text: string, line: LineSpan): boolean => TABLE_ROW.test(text.slice(line.start, line.end));

/** 表の行は一つの行で閉じた記録なので、引く範囲は表の行の境を越えない。from から下がって、表の行に入る手前の行の頭。 */
const reachBack = (text: string, line: LineSpan, from: number): number => {
  if (from >= line.start || line.start === 0) return Math.max(from, line.start);
  const previous = lineAt(text, line.start - 1);
  return isTableRow(text, line) || isTableRow(text, previous) ? line.start : reachBack(text, previous, from);
};

const reachForward = (text: string, line: LineSpan, to: number): number => {
  if (to <= line.end || line.end === text.length) return Math.min(to, line.end);
  const next = lineAt(text, line.end + 1);
  return isTableRow(text, line) || isTableRow(text, next) ? line.end : reachForward(text, next, to);
};

/** text の start から end の前後を、空白をならして引く。表の行の指摘は、その行の中だけ（次の行の升まで続けない）。 */
export const quoteAround = (text: string, start: number, end: number = start + 1): string => {
  const from = reachBack(text, lineAt(text, start), Math.max(0, start - QUOTE_REACH));
  const to = reachForward(text, lineAt(text, Math.max(start, end - 1)), end + QUOTE_REACH);
  return text.slice(from, to).replace(/\s+/gu, " ").trim();
};

/** The sentence holding offset, trimmed: a reader sees whole words, as for the rules that quote their sentence. undefined outside every sentence. */
export const sentenceQuoteAt = (sentences: readonly Sentence[], offset: number): string | undefined =>
  sentences.find((sentence) => sentence.span.start <= offset && offset < sentence.span.end)?.text.trim();
