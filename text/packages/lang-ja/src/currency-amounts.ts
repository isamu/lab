import { parseJapaneseNumber, toHalfWidth } from "./numbers.ts";
import { startsWithUnit } from "./unit-case.ts";

// 通貨の書き方（語彙 currency-notation）と百分率の単位（percent-unit）で読む金額と率。助数詞として読めない書き方
// （¥1,320、US$1,320、1,320米ドル、1,320ユーロ、1,320兆円、1,320 JPY、8.0 %）を、語彙だけを頼りに読む。

export type Multiplier = { readonly pattern: string; readonly weight: number };

export type AmountVocabulary = {
  /** 数の前に書く通貨（¥、US$、JPY）。 */
  readonly before: readonly string[];
  /** 数の後ろに書く通貨（円、米ドル、JPY）と百分率の単位。 */
  readonly after: readonly string[];
  /** 数と後ろの通貨のあいだの桁の語（兆、million）と、それが掛ける数。 */
  readonly multipliers: readonly Multiplier[];
};

export type CurrencyAmount = { readonly start: number; readonly end: number; readonly value: number; readonly unit: string };

const DIGITS = /[0-9０-９][0-9０-９,，.．]{0,15}/gu;
const GAP = /^[ \t\u3000]?/u;
const LATIN = /[A-Za-z]/u;
const WORD_CHAR = /[A-Za-z0-9０-９]/u;
/** 数の前のこの字は、数を別のものの続きにする。英字や数字（v1.2）と、時刻や比の後ろ半分（10:30 の 30）。 */
const CONTINUES_BEFORE = /[A-Za-z0-9０-９:：]/u;
/** 桁の語の前に書く位（「1,320百万ユーロ」の百）。 */
const PLACE = /^[十百千]/u;
/** 数だけを書いた西暦の年（2026）。後ろに空白と通貨が来ても、年のこと（「2020 USD ベース」）がある。 */
const YEAR = /^(?:1[89]|2[01])\d{2}$/u;

const TRAILING_MARKS = new Set([",", "，", ".", "．"]);

/** 「1,320.」の終わりの点やカンマは数の一部にしない。 */
const withoutTrailingMarks = (run: string): string => {
  let end = run.length;
  while (end > 0 && TRAILING_MARKS.has(run.charAt(end - 1))) end -= 1;
  return run.slice(0, end);
};

/** 数の前の通貨。数に触れている短いほう（US$1,320 の $）を取る。英字の通貨は、英字や数字の続きでないものだけ。 */
const markBefore = (text: string, start: number, marks: readonly string[]): string | undefined => {
  const end = start - (GAP.exec(text.slice(start - 1, start))?.[0].length ?? 0);
  return marks
    .filter((mark) => text.startsWith(mark, end - mark.length) && !(LATIN.test(mark) && WORD_CHAR.test(text.charAt(end - mark.length - 1))))
    .toSorted((left, right) => left.length - right.length)[0];
};

const leadingGap = (rest: string): number => GAP.exec(rest)?.[0].length ?? 0;

type Scale = { readonly length: number; readonly weight: number };

const multiplierAt = (text: string, multipliers: readonly Multiplier[]): Multiplier | undefined =>
  multipliers
    .filter((entry) => startsWithUnit(text, 0, entry.pattern) && !(LATIN.test(entry.pattern) && WORD_CHAR.test(text.charAt(entry.pattern.length))))
    .toSorted((left, right) => right.pattern.length - left.pattern.length)[0];

/** 数の直後の桁（「千」「百万」「兆」「 million」）。無ければ 1 倍。 */
const scaleAt = (rest: string, multipliers: readonly Multiplier[]): Scale => {
  const gap = leadingGap(rest);
  const place = PLACE.exec(rest.slice(gap))?.[0] ?? "";
  const placed = place === "" ? undefined : multiplierAt(rest.slice(gap + place.length), multipliers);
  if (placed !== undefined) return { length: gap + place.length + placed.pattern.length, weight: (parseJapaneseNumber(place) ?? 1) * placed.weight };
  const multiplier = multiplierAt(rest.slice(gap), multipliers);
  return multiplier === undefined ? { length: 0, weight: 1 } : { length: gap + multiplier.pattern.length, weight: multiplier.weight };
};

/** 数の後ろの通貨か単位。長いほう（米ドル）を取る。英字のものは、後ろに英字が続かないものだけ（USDT は USD でない）。 */
const markAfter = (rest: string, marks: readonly string[]): { readonly mark: string; readonly gap: number } | undefined => {
  const gap = leadingGap(rest);
  const mark = marks
    .filter((entry) => startsWithUnit(rest, gap, entry) && !(LATIN.test(entry) && WORD_CHAR.test(rest.charAt(gap + entry.length))))
    .toSorted((left, right) => right.length - left.length)[0];
  return mark === undefined ? undefined : { mark, gap };
};

const amountAt = (text: string, match: RegExpExecArray, vocabulary: AmountVocabulary): CurrencyAmount | undefined => {
  const number = withoutTrailingMarks(match[0]);
  const value = parseJapaneseNumber(number);
  const end = match.index + number.length;
  const before = markBefore(text, match.index, vocabulary.before);
  if (value === undefined || (before === undefined && CONTINUES_BEFORE.test(text.charAt(match.index - 1)))) return undefined;
  const scale = scaleAt(text.slice(end), vocabulary.multipliers);
  if (before !== undefined) return { start: match.index, end: end + scale.length, value: value * scale.weight, unit: before };
  const after = markAfter(text.slice(end + scale.length), vocabulary.after);
  if (after === undefined) return undefined;
  // 空白を挟んだ年は通貨の額と読まない。空白の無い「2000ユーロ」は額のまま。
  if (scale.length === 0 && after.gap > 0 && YEAR.test(toHalfWidth(number))) return undefined;
  return { start: match.index, end: end + scale.length + after.gap + after.mark.length, value: value * scale.weight, unit: after.mark };
};

/** 文の中の、通貨の書き方で書いた金額と率。値は桁の語を掛けた数（1,320兆円 は 1,320 × 10^12 円）。 */
export const currencyAmounts = (text: string, vocabulary: AmountVocabulary): CurrencyAmount[] =>
  [...text.matchAll(DIGITS)].flatMap((match) => {
    const amount = amountAt(text, match, vocabulary);
    return amount === undefined ? [] : [amount];
  });
