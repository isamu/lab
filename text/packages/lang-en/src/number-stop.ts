/**
 * sentence-splitter は空白の後の「数字だけ + ピリオド」を、どこにあっても箇条書きの番号と読み、そこで文を切らない。
 * 「in the spring of 2026. We shipped」が 1 文になる。
 *
 * 行の途中にあり、次の語が大文字で始まる番号は文末である。その数字だけを同じ長さの英字に替えて分割器に渡し、
 * 普通の語として読ませる。長さが変わらないので、返る span は元の文字列にそのまま当てはまる。
 * 行頭の番号（「1. First」）と、次が大文字でない番号は替えない。
 */
const NUMBER_WORD = /(?<=\s)\d+(?=\.\s)/g;
const CAPITAL_AFTER_SPACE = /\s+\p{Lu}/uy;
// 分割器の略語表に n だけでできた語は無い。数字の代わりに置いても、略語として読まれない。
const PLAIN_LETTER = "n";

const isFirstOnLine = (text: string, index: number): boolean => text.slice(text.lastIndexOf("\n", index - 1) + 1, index).trim() === "";

const capitalFollows = (text: string, dot: number): boolean => {
  CAPITAL_AFTER_SPACE.lastIndex = dot + 1;
  return CAPITAL_AFTER_SPACE.test(text);
};

const isSentenceEnd = (text: string, index: number, digits: string): boolean => !isFirstOnLine(text, index) && capitalFollows(text, index + digits.length);

/** 文末の番号の数字を英字に替えた文字列。長さは変わらない。 */
export const unmarkNumberStops = (text: string): string =>
  text.replace(NUMBER_WORD, (digits: string, index: number) => (isSentenceEnd(text, index, digits) ? PLAIN_LETTER.repeat(digits.length) : digits));
