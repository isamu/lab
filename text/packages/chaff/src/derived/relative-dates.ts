import type { Span } from "../plugin.ts";
import { calendarDateOf, dateOf, shifted, valueOf, type CalendarDate, type DurationUnit } from "./date-arithmetic.ts";

/**
 * 基準の日付からの相対で書いた日付（「10月2日に申し込み、3日後の10月5日に通知」"Applications open on May 1, 2026. Two weeks
 * later, on May 15, 2026, …"）。相対の期間のすぐ後ろに書いた日付を、基準の日付に期間を足した（前なら引いた）日と比べる。
 * 基準は、同じ文で相対の期間より前にある一番近い日付。文が相対の期間で始まる（「Two weeks later, …」）ときだけ、前の文の日付も
 * 基準にする。基準と書いた日付の片方にしか年が無ければ、月日だけを比べる。
 */
export type DatedValue = Span & { readonly value: string };

/** 「3日後」「two weeks later」: 期間と向き（後なら 1、前なら -1）。 */
export type Relative = Span & { readonly amount: number; readonly unit: DurationUnit; readonly direction: 1 | -1 };

export type RelativeMismatch = { readonly base: DatedValue; readonly relative: Relative; readonly target: DatedValue; readonly expected: string };

export type RelativeInput = {
  readonly source: string;
  /** 文の始まりの昇順。 */
  readonly sentences: readonly Span[];
  /** 書いた順の日付。 */
  readonly dates: readonly DatedValue[];
  readonly relatives: readonly Relative[];
  /** 相対の語と日付のあいだに書いてよい語（の、on）。空白と区切りの記号（、, (）は、いつでもよい。 */
  readonly links: readonly string[];
};

const SEPARATORS = /[\s,、，(（:：]/gu;

/** start の昇順の列で、start が offset 以上の最初の位置。二分探索で、相対の期間ごとに文書の頭から数え直さない。 */
const firstAtOrAfter = (spans: readonly Span[], offset: number): number => {
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((spans[middle]?.start ?? Infinity) < offset) low = middle + 1;
    else high = middle;
  }
  return low;
};

const sentenceIndexOf = (sentences: readonly Span[], offset: number): number => {
  const index = firstAtOrAfter(sentences, offset + 1) - 1;
  const sentence = sentences[index];
  return sentence !== undefined && offset < sentence.end ? index : -1;
};

/** 文の頭から相対の期間までに、空白と記号のほかに何も無い。 */
const opensSentence = (source: string, sentence: Span, relative: Relative): boolean => !/[\p{L}\p{N}]/u.test(source.slice(sentence.start, relative.start));

/** 相対の語のすぐ後ろの日付。あいだは区切りの記号と、つなぎの語だけ。 */
const targetOf = (input: RelativeInput, relative: Relative): DatedValue | undefined => {
  const next = input.dates[firstAtOrAfter(input.dates, relative.end)];
  if (next === undefined) return undefined;
  const between = input.source.slice(relative.end, next.start).replace(SEPARATORS, "").toLowerCase();
  return between === "" || input.links.some((link) => link.replace(SEPARATORS, "").toLowerCase() === between) ? next : undefined;
};

/** 同じ文で、相対の期間より前にある一番近い日付。文の頭の相対の期間なら、前の文まで見る。 */
const baseOf = (input: RelativeInput, relative: Relative): DatedValue | undefined => {
  const index = sentenceIndexOf(input.sentences, relative.start);
  const sentence = input.sentences[index];
  if (sentence === undefined) return undefined;
  const from = opensSentence(input.source, sentence, relative) ? (input.sentences[index - 1]?.start ?? sentence.start) : sentence.start;
  const before = input.dates[firstAtOrAfter(input.dates, relative.start) - 1];
  return before !== undefined && before.end <= relative.start && before.start >= from ? before : undefined;
};

/** 年の無い月日は、年を決めずに数えられない（2月28日の1日後は、うるう年なら2月29日）。考えられる年をすべて試す。 */
const LEAP_YEAR = 2000;
const COMMON_YEAR = 2001;

const baseYears = (base: CalendarDate, target: CalendarDate): number[] => {
  if (base.year !== undefined) return [base.year];
  return target.year === undefined ? [LEAP_YEAR, COMMON_YEAR] : [target.year - 1, target.year, target.year + 1];
};

const mismatchOf = (base: DatedValue, relative: Relative, target: DatedValue): RelativeMismatch | undefined => {
  const [baseDate, targetDate] = [calendarDateOf(base.value), calendarDateOf(target.value)];
  if (baseDate === undefined || targetDate === undefined) return undefined;
  const withYear = baseDate.year !== undefined && targetDate.year !== undefined;
  const written = withYear ? target.value : valueOf(dateOf(targetDate), false);
  const expected = baseYears(baseDate, targetDate).map((year) =>
    valueOf(shifted(dateOf({ ...baseDate, year }), relative.amount * relative.direction, relative.unit), withYear),
  );
  const [shown] = expected;
  return shown === undefined || expected.includes(written) ? undefined : { base, relative, target, expected: shown };
};

export const relativeMismatches = (input: RelativeInput): RelativeMismatch[] =>
  input.relatives.flatMap((relative) => {
    const target = targetOf(input, relative);
    const base = baseOf(input, relative);
    const mismatch = target === undefined || base === undefined ? undefined : mismatchOf(base, relative, target);
    return mismatch === undefined ? [] : [mismatch];
  });
