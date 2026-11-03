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

const DIGITS = /^[0-9０-９]+$/u;

/**
 * 数と一語に解析された日付の単位（全角の「４月」）。連なりは単位から始まるので、単位の分だけの語にして返す。
 * positional は数の後ろに置くだけで暦や時計の位置を言う単位（月、時）。
 */
const gluedUnit = (tokens: readonly Token[], start: number, run: string, positional: readonly string[]): Token | undefined => {
  const token = tokens.find((candidate) => candidate.span.start < start && start < candidate.span.end);
  if (token === undefined) return undefined;
  const unit = positional.find((word) => token.surface.endsWith(word) && DIGITS.test(token.surface.slice(0, -word.length)));
  return unit !== undefined && run.startsWith(unit) ? { ...token, surface: unit, span: { start, end: token.span.end } } : undefined;
};

/**
 * 漢字の連なり run（文書全体の座標で start から始まる）の頭が、直前の数に付いた助数詞（2日、第76回、24時間）なら、その助数詞の語。
 * 数字が区切りを見せるので、助数詞は数と読まれ、後ろの複合語の一部ではない。そうでなければ undefined。
 * 解析が助数詞と言わない日付の単位（4月の「月」）も、positional にあれば助数詞と読む。
 * 折り返しをまたぐ語（年\n度）は span が surface より長いので、連なりの残りは span の終わりから始まる。
 */
export const leadingCounter = (tokens: readonly Token[], start: number, run: string, positional: readonly string[] = []): Token | undefined => {
  const at = tokens.findIndex((token) => token.span.start === start);
  const counter = tokens[at];
  if (counter === undefined) return gluedUnit(tokens, start, run, positional);
  if (!(isCounter(counter) || positional.includes(counter.surface)) || !isNumber(wordBefore(tokens, at))) return undefined;
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

const isBound = (token: Token | undefined): boolean => token?.features?.["Bound"] === "Yes" && !isPrefix(token);

/** 語の並び run の、end（添字、含まない）で終わる序数の項（第三十条、第二項）の頭の添字。項でなければ undefined。 */
const ordinalGroupStart = (run: readonly Token[], end: number): number | undefined => {
  if (!isBound(run[end - 1])) return undefined;
  const numbersStart = run.slice(0, end - 1).findLastIndex((token) => !isNumber(token)) + 1;
  const prefixAt = numbersStart - 1;
  return numbersStart < end - 1 && isPrefix(run[prefixAt]) ? prefixAt : undefined;
};

/** 語の並び run の尻の、序数の項の並びの頭の添字。項が無ければ run.length。 */
const ordinalChainStart = (run: readonly Token[], end: number = run.length): number => {
  const start = ordinalGroupStart(run, end);
  return start === undefined ? end : ordinalChainStart(run, start);
};

/**
 * 漢字の連なり run（文書全体の座標で span）の尻の、序数の項の並び（学校教育法第三十条第二項の「第三十条第二項」）。条や項の番号は
 * 前の名前を指す番号で、前の複合語の一部ではない。項の前に名前が残るときだけ。そうでなければ undefined。
 */
export const trailingOrdinals = (
  tokens: readonly Token[],
  span: { readonly start: number; readonly end: number },
  run: string,
): { readonly surface: string; readonly start: number } | undefined => {
  const words = tokens.filter((token) => token.span.start < span.end && span.start < token.span.end);
  const start = ordinalChainStart(words);
  const first = words[start];
  if (start === 0 || first === undefined) return undefined;
  const chain = words.slice(start);
  const joined = chain.every((token, at) => at === 0 || chain[at - 1]?.span.end === token.span.start);
  const surface = chain.map((token) => token.surface).join("");
  return joined && run.endsWith(surface) ? { surface, start: first.span.start } : undefined;
};
