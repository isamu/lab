import type { Span } from "./plugin.ts";
import { mergeSpans } from "./span-merge.ts";

/**
 * 非 prose（コードブロック・インラインコード・表・見出し・URL）を、
 * **同じ長さの空白**で覆う。改行は残す。
 *
 * 切り出して繋ぐのではなく覆うのは、オフセットを元文字列と一致させ続けるため。
 * 行・列の計算も、引用して見せる範囲も、これで元の位置のまま使える。
 */
/**
 * 空白は**元の文字と同じ UTF-16 長**にする。
 *
 * `u` 付きの正規表現は 1 文字（コードポイント）ずつ当たるので、絵文字のような
 * サロゲートペアを空白 1 つに置き換えると文字列が 1 だけ縮む。mdast のオフセットは
 * UTF-16 単位なので、そこから先の指摘がすべて 1 ずれる。
 */
const blankOut = (text: string): string => text.replace(/[^\n]/gu, (char) => " ".repeat(char.length));

export const maskSpans = (source: string, spans: readonly Span[]): string => {
  const merged = mergeSpans(spans, true);
  // 部品は配列に足していく。範囲ごとに配列を作り直すと、範囲が何万もある文書で二乗に遅くなる。
  const parts: string[] = [];
  const cursor = merged.reduce((at, span) => {
    parts.push(source.slice(at, span.start), blankOut(source.slice(span.start, span.end)));
    return span.end;
  }, 0);
  parts.push(source.slice(cursor));
  return parts.join("");
};
