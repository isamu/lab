import type { NumberedLine, NumberingContext } from "../plugin.ts";

/**
 * 「4.2 設定」「3.1.4 Scope」のような通し番号。数字と点だけで書くので言語を問わない。
 * 各部分を 3 桁・深さを 6 までに抑え、後戻りが爆発しない形にしてある。
 */
const DOTTED = /^[ \t]{0,3}(?<number>\d{1,3}(?:\.\d{1,3}){0,5})\.?[ \t\u3000]+(?<rest>\S.*)$/u;

/**
 * 本文の「1. 」は箇条書きで、見出しの「1. 」は章番号。点を含まない番号は、見出しの行でだけ読む。
 * 「4.2 」のように点を含むものは、.txt の仕様書でも見出しとして書かれるので本文でも読む。
 */
export const dottedNumber = (line: string, context: NumberingContext): NumberedLine | undefined => {
  const groups = DOTTED.exec(line)?.groups;
  const number = groups?.["number"];
  if (number === undefined) return undefined;
  const depth = number.split(".").length;
  if (depth < 2 && !context.isHeading) return undefined;
  const rest = groups?.["rest"]?.trim() ?? "";
  return { kind: "article", depth, number, absolute: true, label: number, heading: rest, rest, ordinal: Number(number.split(".").at(-1)) };
};
