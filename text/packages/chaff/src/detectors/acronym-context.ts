import { escapeRegExp } from "../orthography.ts";
import { ROMAN_NUMERAL } from "./roman-numeral.ts";

/**
 * 大文字の語が略語ではなく、決まった書き方の一部として読める所（3:30 PM、1pm ET、USD 1,000、Kansas City, MO 64108）。
 * どれも閉じた集合で、しかも隣の数字があるときだけ認める。PM（project manager）、CT、CA（certificate authority）は
 * 数字の隣でなければ略語のまま数える。語は言語パッケージの語彙表から読み、書き方の組み立てだけをここに置く。
 */

type Span = { readonly start: number; readonly end: number };

/** 言語パッケージの語彙表から読む、数字の隣でだけ略語から外す語と、単独で強調として書かれる語。字面どおりに照らす。 */
export type NotationWords = {
  readonly meridiem: readonly string[];
  readonly timeZones: readonly string[];
  readonly currencies: readonly string[];
  readonly usStates: readonly string[];
  readonly emphasis: readonly string[];
  /** 番号を後ろに書く、文書の区切りの名前（Part、Section、Title）。 */
  readonly divisions: readonly string[];
  /** 速記録が大文字で書く発言者の姓の前に置く敬称（Mr.、Mrs.、Madam）。 */
  readonly honorifics: readonly string[];
};

// 空の語彙表は「その書き方が無い」。空の選択肢 (?:) は至る所で空文字に当たるので、何にも当たらない形にする。
const oneOf = (words: readonly string[]): string => (words.length === 0 ? "(?!)" : `(?:${words.map(escapeRegExp).join("|")})`);

const MINUTES = String.raw`:[0-5]\d`;
const CLOCK_12 = String.raw`(?<![\d:.])(?:1[0-2]|0?[1-9])(?:${MINUTES})?`;
const CLOCK_24 = String.raw`(?<![\d:.])(?:[01]?\d|2[0-3])${MINUTES}`;
/** 時間帯の前の午前・午後は書き方を問わない（pm、p.m.、P.M.、PM）。 */
const ANY_MERIDIEM = String.raw`[AaPp]\.?[Mm]\.?`;
/** 桁区切りは 3 桁ずつ揃っているときだけ金額と読む。「item 1, USD」の 1, は金額ではない。 */
const AMOUNT = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;

/**
 * 区切りの名前のすぐ後ろのローマ数字は番号（Part II、Section VIII、TITLE IV）。名前は語彙表の書き方か、全部大文字。
 * CD や CI のようにローマ数字としても読める略語は、この位置でなければ略語のまま数える。
 */
const divisionOf = (words: readonly string[]): string => oneOf(words.flatMap((word) => [word, word.toUpperCase()]));

/** 敬称のすぐ後ろの大文字の姓（Mr. HAWLEY、Dr. O'NEIL）。速記録は発言者をこう書き、略語ではない。 */
const SURNAME_IN_CAPITALS = String.raw`[A-Z]+(?:['’-][A-Z]+)*(?![\p{L}\p{N}_])`;

// 強調の記号は空白に置き換えてある（**3:30** PM）ので、部品の間の空白は数を問わない。
const patternsOf = (words: NotationWords): readonly RegExp[] => [
  new RegExp(String.raw`${CLOCK_12}\s*${oneOf(words.meridiem)}`, "gu"),
  new RegExp(String.raw`(?:${CLOCK_24}|${CLOCK_12}\s*${ANY_MERIDIEM})\s*${oneOf(words.timeZones)}`, "gu"),
  new RegExp(String.raw`${oneOf(words.currencies)}\s*[$€£¥]?${AMOUNT}`, "gu"),
  new RegExp(String.raw`(?<![\w.,])${AMOUNT}\s*${oneOf(words.currencies)}`, "gu"),
  new RegExp(String.raw`,\s+${oneOf(words.usStates)}\s+\d{5}(?:-\d{4})?(?!\d)`, "gu"),
  new RegExp(oneOf(words.emphasis), "gu"),
  new RegExp(String.raw`(?<![\p{L}\p{N}_])${divisionOf(words.divisions)}\s+${ROMAN_NUMERAL}(?![\p{L}\p{N}_&])`, "gu"),
  new RegExp(String.raw`(?<![\p{L}\p{N}_])${oneOf(words.honorifics)}\s+${SURNAME_IN_CAPITALS}`, "gu"),
];

export type NotAcronymSpans = (text: string) => Span[];

/**
 * 文の中で、略語として数えない大文字を含む範囲。語彙表から一度だけ組み立てて、文ごとに呼ぶ。
 * 略語は範囲にまるごと入るときだけ外れるので、語の境目は見なくてよい（NOTE の中の NOT）。
 */
export const notAcronymSpansOf = (words: NotationWords): NotAcronymSpans => {
  const patterns = patternsOf(words);
  return (text) => patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length })));
};
