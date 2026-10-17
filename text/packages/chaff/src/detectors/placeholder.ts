import { escapeRegExp } from "../orthography.ts";

/**
 * 日付や時刻の数字の代わりに置く、同じ大文字の繰り返し（令和YY年MM月DD日 HH：MM、MM/DD/YYYY、YYYY-MM-DD）。
 * 定型文の書式で、略語ではない。繰り返しの語が、日付・時刻の単位の語（年、月、日）の前にあるか、
 * 区切り（/、:、-、.）で別の繰り返しの語か数字と繋がっているときだけ認める。単位の語は言語パッケージの語彙表から読む。
 * AI時代の AI や CI/CD の CD は、同じ文字の繰り返しではないので略語のまま数える。
 * 単位の前には空白 1 つを挟んでもよい（XX 月 XX 日）。ひな形が名前の代わりに書く O か X を 4 つ以上並べた語（OOOO、XXXX）も、
 * 単位が無くても略語ではない。3 つまで（AAA、XXX）は略語にもあり、ほかの文字の繰り返し（IIII、MMMMM）は崩れたローマ数字にもある。
 */

type Span = { readonly start: number; readonly end: number };

const REPEATED = /^(?<letter>[A-Z])\k<letter>+$/u;
const PART = String.raw`(?:[A-Z]{2,}|\d+)`;
const SEPARATOR = "[/／:：.-]";
const JOINED = new RegExp(String.raw`(?<![A-Za-z0-9_&])${PART}(?:${SEPARATOR}${PART})+(?![A-Za-z0-9_&])`, "gu");
const CAPITALS = /[A-Z]+/gu;
const LONG_REPEAT = /(?<![A-Za-z0-9_&])(?<letter>[OX])\k<letter>{3,}(?![A-Za-z0-9_&])/gu;

const isRepeated = (word: string): boolean => REPEATED.test(word);

const spanOf = (match: RegExpExecArray): Span => ({ start: match.index, end: match.index + match[0].length });

/** 区切りで繋いだ一続きのうち、大文字の部品がどれも同じ文字の繰り返しのもの（数字だけの 2025/01/31 は略語と関係がない）。 */
const joinedSpans = (text: string): Span[] =>
  [...text.matchAll(JOINED)]
    .filter((match) => {
      const capitals = match[0].match(CAPITALS) ?? [];
      return capitals.length > 0 && capitals.every(isRepeated);
    })
    .map(spanOf);

const beforeUnitSpans = (text: string, units: readonly string[]): Span[] => {
  if (units.length === 0) return [];
  const pattern = new RegExp(String.raw`(?<![A-Za-z0-9_&])[A-Z]{2,}(?= ?(?:${units.map(escapeRegExp).join("|")}))`, "gu");
  return [...text.matchAll(pattern)].filter((match) => isRepeated(match[0])).map(spanOf);
};

/** 文の中の、日付・時刻の書式とひな形の名前に置いた大文字の範囲。units は日付・時刻の単位の語。 */
export const placeholderSpans = (text: string, units: readonly string[]): Span[] => [
  ...joinedSpans(text),
  ...beforeUnitSpans(text, units),
  ...[...text.matchAll(LONG_REPEAT)].map(spanOf),
];
