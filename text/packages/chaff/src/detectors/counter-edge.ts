import type { Token } from "../plugin.ts";

const BLANK = /^\s+$/u;

const isNumber = (token: Token | undefined): boolean => token?.features?.["NumType"] === "Card";
const isCounter = (token: Token | undefined): boolean => token?.features?.["NounType"] === "Class";

const touches = (left: Token, right: Token): boolean => left.span.end === right.span.start;

/** at の語のすぐ前の語。空白一つを挟んでもよい（「2 日」）。 */
const wordBefore = (tokens: readonly Token[], at: number): Token | undefined => {
  const [previous, token] = [tokens[at - 1], tokens[at]];
  if (previous === undefined || token === undefined || !touches(previous, token)) return undefined;
  if (!BLANK.test(previous.surface)) return previous;
  const beyond = tokens[at - 2];
  return beyond !== undefined && touches(beyond, previous) ? beyond : undefined;
};

/**
 * 漢字の連なり run（文書全体の座標で start から始まる）の頭が、直前の数に付いた助数詞（2日、第76回、24時間）なら、その助数詞の語。
 * 数字が区切りを見せるので、助数詞は数と読まれ、後ろの複合語の一部ではない。そうでなければ undefined。
 * 折り返しをまたぐ語（年\n度）は span が surface より長いので、連なりの残りは span の終わりから始まる。
 */
export const leadingCounter = (tokens: readonly Token[], start: number, run: string): Token | undefined => {
  const at = tokens.findIndex((token) => token.span.start === start);
  const counter = tokens[at];
  if (counter === undefined || !isCounter(counter) || !isNumber(wordBefore(tokens, at))) return undefined;
  return run.startsWith(counter.surface) ? counter : undefined;
};

const isPrefix = (token: Token | undefined): boolean => token?.pos === "ADJ" && token.features?.["Bound"] === "Yes";

/** at の語のすぐ後ろの語。空白一つ（改行を含む）を挟んでもよい（「第\n172条」）。 */
const wordAfter = (tokens: readonly Token[], at: number): Token | undefined => {
  const [token, next] = [tokens[at], tokens[at + 1]];
  if (token === undefined || next === undefined || !touches(token, next)) return undefined;
  if (!BLANK.test(next.surface)) return next;
  const beyond = tokens[at + 2];
  return beyond !== undefined && touches(next, beyond) ? beyond : undefined;
};

/**
 * 漢字の連なり run（文書全体の座標で end に終わる）の尻が、すぐ後ろの数に付く接頭の語（地方自治法施行令第172条の「第」）なら、その語。
 * 接頭の語は後ろの数の一部で、前の複合語の一部ではない。そうでなければ undefined。
 */
export const trailingPrefix = (tokens: readonly Token[], end: number, run: string): Token | undefined => {
  // 折り返しをまたぐ語は span が surface より長いので、end で終わる語ではなく end の直前の字を覆う語を探す。
  const at = tokens.findIndex((token) => token.span.start < end && end <= token.span.end);
  const prefix = tokens[at];
  if (prefix === undefined || !isPrefix(prefix) || !isNumber(wordAfter(tokens, at))) return undefined;
  return run.endsWith(prefix.surface) ? prefix : undefined;
};
