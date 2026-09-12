import type { Span } from "./plugin.ts";

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

const merge = (spans: readonly Span[]): Span[] =>
  [...spans]
    .sort((left, right) => left.start - right.start)
    .reduce<Span[]>((acc, span) => {
      const last = acc.at(-1);
      if (last !== undefined && span.start <= last.end) {
        return [...acc.slice(0, -1), { start: last.start, end: Math.max(last.end, span.end) }];
      }
      return [...acc, span];
    }, []);

export const maskSpans = (source: string, spans: readonly Span[]): string => {
  const merged = merge(spans);
  const { parts, cursor } = merged.reduce<{ parts: string[]; cursor: number }>(
    (acc, span) => ({
      parts: [...acc.parts, source.slice(acc.cursor, span.start), blankOut(source.slice(span.start, span.end))],
      cursor: span.end,
    }),
    { parts: [], cursor: 0 },
  );
  return [...parts, source.slice(cursor)].join("");
};
