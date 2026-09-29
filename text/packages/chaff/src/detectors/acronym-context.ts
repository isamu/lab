/**
 * 大文字の語が略語ではなく、決まった書き方の一部として読める所（3:30 PM、1pm ET、USD 1,000、Kansas City, MO 64108）。
 * どれも閉じた集合で、しかも隣の数字があるときだけ認める。PM（project manager）、CT、CA（certificate authority）は
 * 数字の隣でなければ略語のまま数える。
 */

type Span = { readonly start: number; readonly end: number };

const MERIDIEM = ["AM", "PM"];

/** 業務文書で説明なしに書かれる時間帯。ここに無いもの（ACT など）は略語として数える。 */
const TIME_ZONE = ["UTC", "GMT", "JST", "ET", "EST", "EDT", "CT", "CST", "CDT", "MT", "MST", "MDT", "PT", "PST", "PDT", "CET", "CEST"];

/** ISO 4217 のうち、業務文書の読み手が説明なしで通じる主要な通貨。CAD は数の隣でも computer-aided design と読める（3 CAD files）ので入れない。 */
const CURRENCY = ["USD", "EUR", "JPY", "GBP", "CNY", "CHF", "AUD", "KRW", "HKD", "SGD", "INR"];

/** 米国の州・特別区・準州の郵便略号。住所の書き方（, CA 94720）の中でだけ見る。 */
const US_STATE = [
  ...["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY"],
  ...["LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND"],
  ...["OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"],
  ...["DC", "PR", "GU", "VI", "AS", "MP"],
];

/**
 * 略語として読む字面を持たない英語の機能語。単独の NOT や AND は強調で、展開するものが無い。
 * OR（Oregon、operating room）や IS（International Standard）のように略語でもある語は入れない。
 */
const PLAIN_WORD = ["NOT", "AND"];

const oneOf = (words: readonly string[]): string => `(?:${words.join("|")})`;

const MINUTES = String.raw`:[0-5]\d`;
const CLOCK_12 = String.raw`(?<![\d:.])(?:1[0-2]|0?[1-9])(?:${MINUTES})?`;
const CLOCK_24 = String.raw`(?<![\d:.])(?:[01]?\d|2[0-3])${MINUTES}`;
const LOWER_MERIDIEM = String.raw`[ap]\.?m\.?`;
/** 桁区切りは 3 桁ずつ揃っているときだけ金額と読む。「item 1, CAD」の 1, は金額ではない。 */
const AMOUNT = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;

// 強調の記号は空白に置き換えてある（**3:30** PM）ので、部品の間の空白は数を問わない。
const PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`${CLOCK_12}\s*${oneOf(MERIDIEM)}`, "gu"),
  new RegExp(String.raw`(?:${CLOCK_24}|${CLOCK_12}\s*(?:${LOWER_MERIDIEM}|${oneOf(MERIDIEM)}))\s*${oneOf(TIME_ZONE)}`, "gu"),
  new RegExp(String.raw`${oneOf(CURRENCY)}\s*${AMOUNT}`, "gu"),
  new RegExp(String.raw`(?<![\w.,])${AMOUNT}\s*${oneOf(CURRENCY)}`, "gu"),
  new RegExp(String.raw`,\s+${oneOf(US_STATE)}\s+\d{5}(?:-\d{4})?(?!\d)`, "gu"),
  new RegExp(oneOf(PLAIN_WORD), "gu"),
];

/** 文の中で、略語として数えない大文字を含む範囲。略語は範囲にまるごと入るときだけ外れるので、語の境目は見なくてよい（NOTE の中の NOT）。 */
export const notAcronymSpans = (text: string): Span[] =>
  PATTERNS.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length })));
