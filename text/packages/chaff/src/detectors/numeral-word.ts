/**
 * 大文字の並びでも略語として書かれないもの。どれも字の形だけで決まる。
 * - I だけのローマ数字（II、III）。名前の後ろでなくても番号で（Doswell, III、1964: II Structure）、この形の略語は使われない。
 *   IV や VI のように V・X を含む数字は略語（静脈注射の IV）でもあるので、名前の番号（name-numeral.ts）の位置でだけ外す。
 * - 大文字で始まる語に - で繋いだ I・V・X の数字（Association-IV）。名前の番号を空白でなく - で書いた形。
 * - X を 3 つ以上並べた伏せ字（the Secretary of State for XXX）や X の数で書く染色体の型（XXX症候群）。KKK や WWW のような他の字の繰り返しは略語のまま数える。
 */

type Span = { readonly start: number; readonly end: number };

// 略語の切り出しと同じ境目。日本語の文字（XXX症候群）は語の続きではない。
const NOT_BEFORE = String.raw`(?<![A-Za-z0-9_&])`;
const NOT_AFTER = String.raw`(?![A-Za-z0-9_&])`;

const ONES_NUMERAL = new RegExp(`${NOT_BEFORE}I{2,3}${NOT_AFTER}`, "gu");
const MASK = new RegExp(`${NOT_BEFORE}X{3,}${NOT_AFTER}`, "gu");
const SMALL_NUMERAL = "(?=[IVX])X{0,3}(?:IX|IV|V?I{0,3})";
const JOINED_NUMERAL = new RegExp(String.raw`(?<![A-Za-z0-9_-])\p{Lu}\p{Ll}+-(?<numeral>${SMALL_NUMERAL})${NOT_AFTER}`, "gu");

const spanOf = (match: RegExpExecArray): Span => ({ start: match.index, end: match.index + match[0].length });

const joinedSpans = (text: string): Span[] =>
  [...text.matchAll(JOINED_NUMERAL)].map((match) => {
    const end = match.index + match[0].length;
    return { start: end - (match.groups?.["numeral"] ?? "").length, end };
  });

/** 文の中の、番号か伏せ字と読む大文字の範囲。 */
export const numeralWordSpans = (text: string): Span[] => [
  ...[...text.matchAll(ONES_NUMERAL)].map(spanOf),
  ...[...text.matchAll(MASK)].map(spanOf),
  ...joinedSpans(text),
];
