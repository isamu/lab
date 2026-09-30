import type { Token } from "../plugin.ts";
import { MINOR_WORDS } from "./heading-case.ts";

// 引用した題名（誌名・論文名・書名）。題名の中の読点は題名を付けた人のもので、書き手が並べかたを選んだものではない。

const isCapitalised = (token: Token): boolean => /^\p{Lu}/u.test(token.surface);

/** 題名の中の語。大文字で始まる語と、Title Case でも小文字のままの語（of, and, a）と、語をつなぐハイフン。 */
const isTitleWord = (token: Token): boolean => isCapitalised(token) || MINOR_WORDS.has(token.surface) || token.surface === "-";

/** 題名の中の区切り。左は読点もまたぐ（Journal of Money, Credit）。 */
const inLeftRun = (token: Token): boolean => isTitleWord(token) || token.surface === ",";

/** 2 つの語の間が空白だけか。覆った強調の印（*Journal）や記号を挟めば、題名の語の続きはそこで切れる。 */
const adjoins = (source: string, left: Token | undefined, right: Token | undefined): boolean =>
  left === undefined || right === undefined || source.slice(left.span.end, right.span.start).trim() === "";

/** and / or の左の、題名の語の続きの頭。最初の大文字の語から。 */
const leftStart = (tokens: readonly Token[], at: number, source: string): number | undefined => {
  const stop = tokens.slice(0, at).findLastIndex((token, index) => !inLeftRun(token) || !adjoins(source, token, tokens[index + 1]));
  const start = tokens.findIndex((token, index) => index > stop && index < at && isCapitalised(token));
  return start === -1 ? undefined : start;
};

/** and / or の右の、題名の語の続きの最後の大文字の語。最初の語（小文字の語を飛ばして）が大文字でなければ無い。 */
const rightEnd = (tokens: readonly Token[], at: number, source: string): number | undefined => {
  const stop = tokens.findIndex((token, index) => index > at && (!isTitleWord(token) || !adjoins(source, tokens[index - 1], token)));
  const run = tokens.slice(at + 1, stop === -1 ? undefined : stop);
  const first = run.find((token) => !MINOR_WORDS.has(token.surface));
  const last = run.findLastIndex(isCapitalised);
  return first === undefined || !isCapitalised(first) || last === -1 ? undefined : at + 1 + last;
};

/** 印を探す幅。いちばん長い印（***）と前後の 1 字と空白が収まる。行頭の ^ は文書の頭でだけ当たる。 */
const MARK_REACH = 8;

/** 題名の直前の、左の語から離れた開きの印（“ ‘ " ' * _）。空白・行頭・括弧のあとにあって、語にくっつく。 */
const OPENING = /(?:^|[\s([{])(?:["'“‘]|\*{1,3}|_{1,3})$/u;
/** 題名の直後の閉じの印。句読点を挟んでよい（Employment,”）。 */
const CLOSING = /^[,.;:!?]?(?:["'”’]|\*{1,3}|_{1,3})(?![\p{L}\p{N}])/u;
/** 引用した論文名のあとの読点と閉じる引用符。そのあとの題名は誌名（"Three Lessons," Journal of Money, Credit and Banking）。 */
const AFTER_QUOTED_TITLE = /,\s*["'”’]\s*$/u;

/**
 * at の and / or が、引用した題名の中にあるか。and / or の両隣が Title Case の語の続きで、その続きが
 * 引用符か強調の印で囲まれているか、引用符で閉じた論文名のすぐ後ろ（誌名）にあるとき。
 * 本文の固有名詞の並び（Login.gov, TTS Engineering and USAi）や著者の並びは囲まれていないので、題名と読まない。
 */
export const inCitedTitle = (tokens: readonly Token[], at: number, source: string): boolean => {
  const start = leftStart(tokens, at, source);
  const end = rightEnd(tokens, at, source);
  const first = start === undefined ? undefined : tokens[start];
  const last = end === undefined ? undefined : tokens[end];
  if (first === undefined || last === undefined) return false;
  const before = source.slice(Math.max(0, first.span.start - MARK_REACH), first.span.start);
  const enclosed = OPENING.test(before) && CLOSING.test(source.slice(last.span.end, last.span.end + MARK_REACH));
  return enclosed || AFTER_QUOTED_TITLE.test(before);
};
