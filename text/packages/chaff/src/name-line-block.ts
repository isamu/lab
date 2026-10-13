import type { Token } from "./plugin.ts";

/**
 * 1 行に 1 つずつ書いた短い行の並び（署名の 名前／役職／学校名、住所の行）。Markdown では一つの段落、一つの文になり、名前の
 * 語の続きが次の行の頭の語（Mr Daniel Whitfield⏎Head of Year 9 の Head）まで伸びる。行が文の終わりの記号で終わらず、どの行も
 * 短く、小文字で始まらず、行の数も少ないときだけ、行ごとに名前を読む。折り返したふつうの文は最後の行が文の終わりの記号で
 * 終わるか、行が長いか、小文字で始まる行を持つ。
 */

/** 行ごとに読む行の語の数の上限。折り返した文の行はこれより長い。 */
const MAX_LINE_WORDS = 6;
/** 行ごとに読む文の行の数の上限。署名や住所は収まる。長い一覧の一語の地名は、分けるとふつうの語と一字違いに見える。 */
const MAX_BLOCK_LINES = 8;
const SENTENCE_END = /[.!?。！？:;：；]["'”’)）]*$/u;
const LOWERCASE_START = /^\p{Ll}/u;
const NEWLINE = /\r?\n/u;
const WORD = /\S+/gu;

const isItemLine = (line: string): boolean =>
  line !== "" && !SENTENCE_END.test(line) && !LOWERCASE_START.test(line) && (line.match(WORD) ?? []).length <= MAX_LINE_WORDS;

/** 文が、短い行を 1 行に 1 つずつ並べたものか。 */
export const isLineBlock = (text: string): boolean => {
  const lines = text
    .trim()
    .split(NEWLINE)
    .map((line) => line.trim());
  return lines.length >= 2 && lines.length <= MAX_BLOCK_LINES && lines.every(isItemLine);
};

/** 語を、あいだに改行を挟むところで分けた並び。text は start の位置から始まる文字列で、語の範囲を覆う。 */
export const tokensByLine = (tokens: readonly Token[], text: string, start = 0): Token[][] =>
  tokens.reduce<Token[][]>((lines, token, index) => {
    const previous = tokens[index - 1];
    const breaks = previous !== undefined && NEWLINE.test(text.slice(previous.span.end - start, token.span.start - start));
    const current = lines.at(-1);
    if (current === undefined || breaks) lines.push([token]);
    else current.push(token);
    return lines;
  }, []);
