/**
 * 大文字で始まる語のすぐ後ろの、I・V・X だけで書いたローマ数字（Engineer II、Leopold III、World War II）。名前に付く
 * 番号で、略語ではない。語の前に文字が無ければ（文の頭、箇条書きの番号の後ろ）、大文字は名前の印ではなく文頭の書き方なので
 * 外さない（Start IV fluids、1. Give IV fluids）。
 * CD、MD、DC、CI、MIX のように C・D・L・M を含む数字は略語であることが多いので、この位置でも略語のまま数える。
 */

type Span = { readonly start: number; readonly end: number };

const SMALL_NUMERAL = "(?=[IVX])X{0,3}(?:IX|IV|V?I{0,3})";
const NAMED_NUMERAL = new RegExp(String.raw`(?<![\p{L}\p{N}_])\p{Lu}\p{Ll}+\s+(?<numeral>${SMALL_NUMERAL})(?![\p{L}\p{N}_&])`, "gu");
const LETTER = /\p{L}/u;

/** 文の中の、名前の後ろの番号の範囲（数字だけ）。 */
export const nameNumeralSpans = (text: string): Span[] =>
  [...text.matchAll(NAMED_NUMERAL)]
    .filter((match) => LETTER.test(text.slice(0, match.index)))
    .map((match) => {
      const numeral = match.groups?.["numeral"] ?? "";
      const end = match.index + match[0].length;
      return { start: end - numeral.length, end };
    });
