import type { Span } from "./plugin.ts";

const FULLWIDTH_OFFSET = 0xfee0;
const LATIN_LETTER = /[A-Za-z]/u;

/** 名前の中の字の前後に、ほかの英字や「．」が続かないこと（Zinc の inc、U.S.A. の S.A. は形ではない）。 */
const BEFORE = "(?<![A-Za-zＡ-Ｚａ-ｚ.．])";
const AFTER = "(?![A-Za-zＡ-Ｚａ-ｚ])";

const escaped = (char: string): string => char.replace(/[.*+?^${}()|[\]\\]/u, "\\$&");

/** 半角の字と、その全角の字のどちらでも合う形。空白は無くても合う。 */
const charPattern = (char: string): string => {
  if (char === " ") return "[\\s\\u3000]?";
  const code = char.codePointAt(0) ?? 0;
  const fullwidth = String.fromCodePoint(code + FULLWIDTH_OFFSET);
  return LATIN_LETTER.test(char) || /[.,]/u.test(char) ? `[${escaped(char)}${fullwidth}]` : escaped(char);
};

/** 形の終わりの「.」は無くても合う（Co., Ltd と Co., Ltd.）。 */
const formPattern = (form: string): string => {
  const body = form.endsWith(".") ? form.slice(0, -1) : form;
  const tail = form.endsWith(".") ? `(?:${charPattern(".")})?` : "";
  return [...body].map(charPattern).join("") + tail;
};

/** 形の語彙表を、一つの正規表現にする。長い形を先に試す。 */
export const latinCompanyFormRegExp = (forms: readonly string[]): RegExp | undefined => {
  if (forms.length === 0) return undefined;
  const longestFirst = [...forms].sort((a, b) => b.length - a.length);
  return new RegExp(`${BEFORE}(?:${longestFirst.map(formPattern).join("|")})${AFTER}`, "giu");
};

/** text の中の、英字の会社の名前の後ろに立つ形（CO.，LTD.、Inc.）の位置。大文字・小文字と全角・半角を問わない。 */
export const latinCompanyFormSpans = (text: string, pattern: RegExp | undefined): Span[] =>
  pattern === undefined ? [] : [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
