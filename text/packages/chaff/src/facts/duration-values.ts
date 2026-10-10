import type { DurationUnit } from "../derived/date-arithmetic.ts";
import type { FactValue } from "./fact-values.ts";
import { scaledDuration } from "./duration-scale.ts";

/**
 * 期間の値（3 months、3ヶ月間）。木の数量は、英語では数だけ（3 の後ろの months は単位として持つ）、日本語では か月 までで 間 を含まない。
 * 値を期間の単位の語の終わりまで延ばし、単位を期間の大きさ（month）に揃える（3ヶ月 と 6か月、1 month と 6 months を比べる）。
 * 年は月に直して比べる（1年 と 12か月）。月と日のように長さの決まらない組は、別の単位のまま。後ろに語が続く期間（3 months ago、30 years old）は、名前付きの値の
 * 終わり（fact-value-end）で落ちる。
 */
export type DurationWord = { readonly pattern: string; readonly unit: DurationUnit };

const folded = (text: string): string => text.normalize("NFKC").toLowerCase();

const UNIT_GAPS = new Set([" ", "\t"]);

/** 書いた単位の始まり。数のすぐ後ろか、空白一つの後ろ。木の値が単位まで含んでいれば、その単位の頭。 */
const unitStartOf = (source: string, value: FactValue): number | undefined => {
  const written = folded(value.unit);
  if (written === "") return undefined;
  if (folded(source.slice(value.end - value.unit.length, value.end)) === written) return value.end - value.unit.length;
  const gap = UNIT_GAPS.has(source.charAt(value.end)) ? 1 : 0;
  return folded(source.slice(value.end + gap, value.end + gap + value.unit.length)) === written ? value.end + gap : undefined;
};

const LATIN_LETTER = /[a-z]/iu;

/** 単位の頭から書いた、一番長い期間の語（ヶ月 より ヶ月間）。英字の語は語の途中で切らない。 */
const longestAt = (source: string, at: number, words: readonly DurationWord[]): DurationWord | undefined =>
  words
    .filter((word) => folded(source.slice(at, at + word.pattern.length)) === folded(word.pattern))
    .filter((word) => !(LATIN_LETTER.test(word.pattern.slice(-1)) && LATIN_LETTER.test(source.charAt(at + word.pattern.length))))
    .reduce<DurationWord | undefined>((longest, word) => (longest === undefined || word.pattern.length > longest.pattern.length ? word : longest), undefined);

const durationOf = (source: string, value: FactValue, words: readonly DurationWord[]): FactValue[] => {
  if (value.kind !== "quantity" || !words.some((word) => folded(word.pattern) === folded(value.unit))) return [];
  const at = unitStartOf(source, value);
  const word = at === undefined ? undefined : longestAt(source, at, words);
  return at === undefined || word === undefined ? [] : [{ ...value, end: at + word.pattern.length, ...scaledDuration(value.key, word.unit) }];
};

/** 期間の単位の付いた数量だけを、単位の語まで含む期間の値にして返す。 */
export const durationValues = (source: string, values: readonly FactValue[], words: readonly DurationWord[]): FactValue[] =>
  values.flatMap((value) => durationOf(source, value, words));
