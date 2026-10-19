import type { Span } from "chaffjs/plugin";

/**
 * 句点で閉じた引用が行の終わりにあるとき（「…こたえる。」の後で改行）、分割器は括弧の組の後ろで文を切らず、次の行の文まで
 * 一つの文にする。演説や宣誓の引用を一行ずつ置いた文書では、次の行は別の文である。
 * 文末の記号 + 閉じ括弧 + 改行で切る。次の行が「と」や読点で始まるもの（「…。」\nと述べた）は引用が文の途中にあるので切らない。
 */
const QUOTE_AT_LINE_END = /[。．！？!?][」』）)]+[ \t　]*(?=\r?\n)/gu;
const CONTINUES = /^\s*[と、，。」』）)]/u;

/** span の文を、行の終わりで閉じた引用ごとに分けた span。切れ目が無ければ span そのもの一つ。 */
export const splitAtQuotedLineEnds = (text: string, span: Span): Span[] => {
  const sentence = text.slice(span.start, span.end);
  const cuts = [...sentence.matchAll(QUOTE_AT_LINE_END)]
    .map((match) => match.index + match[0].length)
    .filter((end) => !CONTINUES.test(sentence.slice(end)) && sentence.slice(end).trim() !== "");
  const starts = [0, ...cuts.map((end) => end + (/^\s+/u.exec(sentence.slice(end))?.[0].length ?? 0))];
  const ends = [...cuts, sentence.length];
  return starts.map((start, index) => ({ start: span.start + start, end: span.start + (ends[index] ?? start) }));
};
