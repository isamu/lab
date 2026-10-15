import type { Span } from "./plugin.ts";

const FULLWIDTH_OFFSET = 0xfee0;
const LATIN_LETTER = /[A-Za-z]/u;
const SPACE = "[\\s\\u3000]";

/**
 * 形は名前の後ろに立つ。前は大文字か数字で始まる名前の語か括弧で、あいだは空白か「,」だけ（AOBA INC.、AOBA,INC.、
 * (THAILAND) CO.,LTD.）。語の中（Zinc の inc）、略語の中（U.S.A. の S.A.）、名前の無い所（the LLC）の同じ字は形ではない。
 */
const NAME_WORD = "(?<![A-Za-zＡ-Ｚａ-ｚ])[A-ZＡ-Ｚ0-9０-９][A-Za-zＡ-Ｚａ-ｚ0-9０-９&＆]*";
const BEFORE = `(?<=${NAME_WORD}(?:${SPACE}|[,，]${SPACE}?)|[)）]${SPACE}?)`;
const AFTER = "(?![A-Za-zＡ-Ｚａ-ｚ0-9０-９&＆])";

const escaped = (char: string): string => char.replace(/[.*+?^${}()|[\]\\]/u, "\\$&");

const widths = (char: string): string[] => [char, String.fromCodePoint((char.codePointAt(0) ?? 0) + FULLWIDTH_OFFSET)];

/** 一字の形。英字は大文字・小文字と全角・半角のどれでも、点と「,」は全角・半角のどちらでも合う。空白は無くても合う。 */
const charPattern = (char: string): string => {
  if (char === " ") return `${SPACE}?`;
  if (LATIN_LETTER.test(char)) return `[${[char.toUpperCase(), char.toLowerCase()].flatMap(widths).join("")}]`;
  return /[.,]/u.test(char) ? `[${widths(char).map(escaped).join("")}]` : escaped(char);
};

/** 形は点まで書いたとおりに照らす。点の無い LTD（the LTD fund）は形と読まない。英字で終わる形（LLC）は語の終わりで閉じる。 */
const formPattern = (form: string): string => [...form].map(charPattern).join("") + (LATIN_LETTER.test(form.slice(-1)) ? AFTER : "");

/** 形の語彙表を、一つの正規表現にする。長い形を先に試す。名前の語は大文字で始まるので、大文字・小文字は形の側だけで問わない。 */
export const latinCompanyFormRegExp = (forms: readonly string[]): RegExp | undefined => {
  if (forms.length === 0) return undefined;
  const longestFirst = [...forms].sort((a, b) => b.length - a.length);
  return new RegExp(`${BEFORE}(?:${longestFirst.map(formPattern).join("|")})`, "gu");
};

/** text の中の、英字の会社の名前の後ろに立つ形（CO.，LTD.、Inc.）の位置。大文字・小文字と全角・半角を問わない。 */
export const latinCompanyFormSpans = (text: string, pattern: RegExp | undefined): Span[] =>
  pattern === undefined ? [] : [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
