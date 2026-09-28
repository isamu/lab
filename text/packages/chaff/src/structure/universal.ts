import type { NumberedLine, NumberingContext } from "../plugin.ts";

/**
 * 「4.2 設定」「3.1.4 Scope」のような通し番号。数字と点だけで書くので言語を問わない。
 * 各部分を 3 桁・深さを 6 までに抑え、後戻りが爆発しない形にしてある。
 */
const DOTTED = /^[ \t]{0,3}(?<number>\d{1,3}(?:\.\d{1,3}){0,5})\.?[ \t\u3000]+(?<rest>\S.*)$/u;

/**
 * RFC のようなテキストの仕様書（Markdown でないもの）の章見出し「5.  Security Considerations」。Markdown では、行内のコードを伏せた空白が
 * 同じ形に見えるので読まない。行頭から、点の後ろに空白が 2 つ以上あり、
 * 見出しは文として終わらない（句点・ピリオド・読点で終わらない）短い語句。箇条書きの「1. 」は空白 1 つで、文で終わる。
 */
const TOP_SECTION = /^\d{1,3}\. {2,}\S/u;
const SENTENCE_END = /[.。:;,、!?！？]$/u;
const MAX_TITLE = 80;

const isTopSection = (line: string, rest: string): boolean => TOP_SECTION.test(line) && rest.length <= MAX_TITLE && !SENTENCE_END.test(rest);

/**
 * 本文の「1. 」は箇条書きで、見出しの「1. 」は章番号。点を含まない番号は、見出しの行か、テキストの章見出しの形でだけ読む。
 * 「4.2 」のように点を含むものは、.txt の仕様書でも見出しとして書かれるので本文でも読む。
 */
export const dottedNumber = (line: string, context: NumberingContext, plainText = false): NumberedLine | undefined => {
  const groups = DOTTED.exec(line)?.groups;
  const number = groups?.["number"];
  if (number === undefined) return undefined;
  const depth = number.split(".").length;
  const rest = groups?.["rest"]?.trim() ?? "";
  if (depth < 2 && !context.isHeading && !(plainText && isTopSection(line, rest))) return undefined;
  return { kind: "article", depth, number, absolute: true, label: number, heading: rest, rest, ordinal: Number(number.split(".").at(-1)) };
};
