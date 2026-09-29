import type { Span, Token } from "./plugin.ts";

/**
 * 消える改行のうち、どれを消して読むか。決めるのは解析器が読んだ語（全部の改行を消して読んだもの）。
 *
 * Markdown の段落は改行を消して表示されるが、書いた人は改行で区切ったつもりのことがある。
 * 番号だけの見出しの行（「2.1 注文の登録\n登録は」）、宛先や署名を 1 行に 1 つ書いた並び。
 * そこを消して読むと「登録登録」が語の重なりになる。行が続いていると語で言えるときだけ消す。
 */

const inside = (token: Token, part: Span): boolean => token.span.start < part.start && token.span.end > part.end;

/** 解析器が語の途中に置いた改行。語をまたぐなら、行を折り返しただけ。 */
export const wrapBreaks = (breaks: readonly Span[], tokens: readonly Token[]): Span[] => breaks.filter((part) => tokens.some((token) => inside(token, part)));

/** 句を閉じない語。助詞・接続助詞・接続詞で終わる行は、次の行へ続く。 */
const CONTINUING_POS = new Set(["ADP", "SCONJ", "CCONJ"]);
/** 読点で終わる行も続く。句点・括弧・名詞で終わる行は、見出しや 1 行 1 項目の終わりと見分けられない。 */
const COMMAS = new Set(["、", "，"]);

const continuesPast = (token: Token): boolean => CONTINUING_POS.has(token.pos) || COMMAS.has(token.surface);

/** 行が続いている改行: 語をまたぐものと、句を閉じない語の直後にあるもの。 */
export const continuedBreaks = (breaks: readonly Span[], tokens: readonly Token[]): Span[] =>
  breaks.filter((part) => tokens.some((token) => inside(token, part) || (token.span.end === part.start && continuesPast(token))));
