import type { NumberedLine, NumberingContext, StructurePatterns } from "../plugin.ts";
import { numberInSentence } from "./number-in-sentence.ts";

/**
 * 「4.2 設定」「3.1.4 Scope」のような通し番号。数字と点だけで書くので言語を問わない。
 * 各部分を 3 桁・深さを 6 までに抑え、後戻りが爆発しない形にしてある。
 */
const DOTTED = /^[ \t]{0,3}(?<number>\d{1,3}(?:\.\d{1,3}){0,5})(?<closing>\.)?[ \t\u3000]+(?<rest>\S.*)$/u;

/**
 * RFC のようなテキストの仕様書（Markdown でないもの）の章見出し「5.  Security Considerations」。Markdown では、行内のコードを伏せた空白が
 * 同じ形に見えるので読まない。行頭から、点の後ろに空白が 2 つ以上あり、
 * 見出しは文として終わらない（句点・ピリオド・読点で終わらない）短い語句。箇条書きの「1. 」は空白 1 つで、文で終わる。
 */
const TOP_SECTION = /^\d{1,3}\. {2,}\S/u;
const SENTENCE_END = /[.。:;,、!?！？]$/u;
const MAX_TITLE = 80;

const isTopSection = (line: string, rest: string): boolean => TOP_SECTION.test(line) && rest.length <= MAX_TITLE && !SENTENCE_END.test(rest);

/** closedByDot: 番号を点で閉じたか（「5. 」）。「1.5 万人」の 1.5 は閉じていない。 */
type DottedLine = NumberedLine & { readonly closedByDot: boolean };

/**
 * 本文の「1. 」は箇条書きで、見出しの「1. 」は章番号。点を含まない番号は、見出しの行か、テキストの章見出しの形でだけ読む。
 * 「4.2 」のように点を含むものは、.txt の仕様書でも見出しとして書かれるので本文でも読む。
 */
export const dottedNumber = (line: string, context: NumberingContext, plainText = false): DottedLine | undefined => {
  const groups = DOTTED.exec(line)?.groups;
  const number = groups?.["number"];
  if (number === undefined) return undefined;
  const depth = number.split(".").length;
  const rest = groups?.["rest"]?.trim() ?? "";
  if (depth < 2 && !context.isHeading && !(plainText && isTopSection(line, rest))) return undefined;
  const closedByDot = groups?.["closing"] !== undefined;
  return { kind: "article", depth, number, absolute: true, label: number, heading: rest, rest, ordinal: Number(number.split(".").at(-1)), closedByDot };
};

/**
 * 番号の後ろが単位なら数量（「1.5 万人」「2.5 days」）。点で閉じた番号（「5. ページ自身の通信」「2. Days off」）は札で、
 * 数量はそう書かないので、後ろに単位の語が来ても数量にしない。
 */
export const isAmount = (dotted: DottedLine, countedAfter: StructurePatterns["countedAfter"]): boolean =>
  !dotted.closedByDot && countedAfter?.(dotted.number, dotted.rest) === true;

/** 言語を問わない通し番号。後ろが単位なら数量、本文の文の続きなら文の中の数なので、番号にしない。 */
export const universalNumber = (patterns: StructurePatterns, text: string, context: NumberingContext, plainText: boolean): NumberedLine | undefined => {
  const dotted = dottedNumber(text, context, plainText);
  if (dotted === undefined || isAmount(dotted, patterns.countedAfter)) return undefined;
  const numbered = { number: dotted.number, rest: dotted.rest, isHeading: context.isHeading };
  return numberInSentence(numbered, patterns.continuesSentence) ? undefined : dotted;
};
