import type { StructureIssue } from "./issues.ts";
import { shownTotal, type Amount } from "./total.ts";

/**
 * 文の中で書いた合計と内訳。表や箇条書きでなく、一つの文に並べた金額を読む。二つの形がある。
 *   内訳のあとに合計:  「保守費60,000円、運用費30,000円とし、合計100,000円とする」 "$6,000 for hosting and $3,000 for support, for a total of $9,000"
 *   合計のあとに内訳:  「月額150,000円（内訳：保守費90,000円、運用費60,000円）」 "costs $8 per month, made up of a base fee of $6 and a storage fee of $2"
 * 合計の語（total-phrase）はすぐ後ろに合計の金額が来る語、内訳の語（breakdown-phrase）はすぐ後ろから内訳が始まる語。
 * 内訳は合計と同じ単位の金額で、二つ以上。合計の語のすぐ前（内訳の語のすぐ後ろ）から続く並びのどれかの和が合計と合えば
 * 合っているとみなし、どれとも合わないときだけ言う。文の中のほかの金額（単価・上限・遅延損害金）を内訳に数えて誤って言わないため。
 * 値引きの語（discount-word）のすぐ後ろの金額は引く。内訳の語の前の金額は、あいだに並びをつなぐ語（breakdown-gap-joiner）が
 * あれば、別の項目の金額で合計ではない（a $1,000 onboarding fee and a monthly subscription, consisting of …）。
 */
export type TotalWords = {
  readonly totals: readonly string[];
  readonly breakdowns: readonly string[];
  readonly discounts: readonly string[];
  readonly joiners: readonly string[];
};

type Span = { readonly start: number; readonly end: number };

const CENTS = 100;
const MIN_PARTS = 2;

/** 合計の語と金額のあいだに書いてよいもの: 空白と、コロンか読点一つ。 */
const isTotalGap = (gap: string): boolean => /^[:：、,，]?$/u.test(gap.trim());
const OPENERS = "（(";
const CLOSERS = "）)";
const CLOSER = /[）)]/u;

const centsOf = (amount: Amount): number => Math.round(amount.value * CENTS);

const sumOf = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);

/** 英字で始まる語は、英字の続き（subtotal の total）では語と読まない。 */
const LATIN = /[A-Za-z0-9]/u;

const occurrences = (lower: string, phrase: string): number[] =>
  [...lower.matchAll(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu"))].map((match) => match.index);

/** 語の文の中の位置。重なるときは前から、同じ所から始まるなら長いほうを取る。大文字小文字は区別しない。 */
export const phraseSpans = (text: string, start: number, phrases: readonly string[]): Span[] => {
  const lower = text.toLowerCase();
  const found = phrases
    .map((phrase) => phrase.toLowerCase())
    .filter((phrase) => phrase !== "")
    .flatMap((phrase) =>
      occurrences(lower, phrase)
        .filter((at) => !(LATIN.test(phrase[0] ?? "") && LATIN.test(lower[at - 1] ?? "")))
        .map((at) => ({ start: at, end: at + phrase.length })),
    )
    .toSorted((left, right) => left.start - right.start || right.end - left.end);
  return found
    .filter((span, index) => found.slice(0, index).every((before) => before.end <= span.start))
    .map((span) => ({ start: start + span.start, end: start + span.end }));
};

/** 金額の前に書いた単位（$9,000 の $）を除いた、語と金額のあいだ。 */
const gapBefore = (source: string, from: number, amount: Amount): string => {
  const gap = source.slice(from, amount.offset);
  const trimmed = gap.trimEnd();
  return trimmed.endsWith(amount.unit) ? trimmed.slice(0, trimmed.length - amount.unit.length) : gap;
};

/** 合計の語に近いほうから続く、二つ以上の並び（後ろ寄せ: 合計の前の内訳、前寄せ: 合計の後ろの内訳）。 */
const nearRuns = (parts: readonly number[], nearEnd: boolean): number[][] =>
  parts.slice(MIN_PARTS - 1).map((_, index) => (nearEnd ? parts.slice(parts.length - MIN_PARTS - index) : parts.slice(0, MIN_PARTS + index)));

/** 内訳の金額。前の金額（並びの始まり）からこの金額までに値引きの語があれば、負の数。 */
const signedValues = (source: string, parts: readonly Amount[], from: number, discounts: readonly string[]): number[] =>
  parts.map((part, index) => {
    const start = parts[index - 1]?.end ?? from;
    const discounted = phraseSpans(source.slice(start, part.offset), start, discounts).length > 0;
    return discounted ? -centsOf(part) : centsOf(part);
  });

type Breakdown = { readonly total: Amount; readonly parts: readonly Amount[]; readonly from: number; readonly nearEnd: boolean };

const mismatch = (source: string, breakdown: Breakdown, discounts: readonly string[]): StructureIssue[] => {
  const { total, from, nearEnd } = breakdown;
  const parts = breakdown.parts.filter((part) => part.unit === total.unit);
  if (parts.length < MIN_PARTS) return [];
  const values = signedValues(source, parts, from, discounts);
  const written = centsOf(total);
  if (nearRuns(values, nearEnd).some((run) => sumOf(run) === written)) return [];
  return [{ offset: total.offset, values: shownTotal(source, total, sumOf(values)) }];
};

/** 内訳の語が括弧の中にあれば、その括弧の終わり。無ければ文の終わり。 */
const breakdownEnd = (source: string, total: Amount, marker: Span, sentence: Span): number => {
  const between = source.slice(total.end, marker.start);
  const opened = [...between].filter((char) => OPENERS.includes(char)).length > [...between].filter((char) => CLOSERS.includes(char)).length;
  if (!opened) return sentence.end;
  const close = CLOSER.exec(source.slice(marker.end, sentence.end));
  return close === null ? sentence.end : marker.end + close.index;
};

const inside = (amounts: readonly Amount[], start: number, end: number): Amount[] => amounts.filter((amount) => amount.offset >= start && amount.end <= end);

/** 合計の語のすぐ後ろの金額を、その前の内訳と比べる。内訳は、前の合計の語か内訳の語より後ろから。 */
const totalsAfterParts = (source: string, sentence: Span, amounts: readonly Amount[], words: TotalWords): StructureIssue[] => {
  const text = source.slice(sentence.start, sentence.end);
  const markers = phraseSpans(text, sentence.start, words.totals);
  const breakdowns = phraseSpans(text, sentence.start, words.breakdowns);
  return markers.flatMap((marker, index) => {
    const total = amounts.find((amount) => amount.offset >= marker.end && isTotalGap(gapBefore(source, marker.end, amount)));
    if (total === undefined) return [];
    const from = Math.max(sentence.start, markers[index - 1]?.end ?? 0, ...breakdowns.filter((span) => span.end <= marker.start).map((span) => span.end));
    return mismatch(source, { total, parts: inside(amounts, from, marker.start), from, nearEnd: true }, words.discounts);
  });
};

/** 内訳の語のすぐ前の金額を合計とし、内訳の語の後ろ（括弧の中なら括弧の終わりまで、次の合計の語まで）の金額と比べる。 */
const totalsBeforeParts = (source: string, sentence: Span, amounts: readonly Amount[], words: TotalWords): StructureIssue[] => {
  const text = source.slice(sentence.start, sentence.end);
  const totalMarkers = phraseSpans(text, sentence.start, words.totals);
  return phraseSpans(text, sentence.start, words.breakdowns).flatMap((marker) => {
    const total = amounts.findLast((amount) => amount.end <= marker.start);
    if (total === undefined || phraseSpans(source.slice(total.end, marker.start), total.end, words.joiners).length > 0) return [];
    const nextTotal = totalMarkers.find((span) => span.start >= marker.end)?.start ?? sentence.end;
    const parts = inside(amounts, marker.end, Math.min(nextTotal, breakdownEnd(source, total, marker, sentence)));
    return mismatch(source, { total, parts, from: marker.end, nearEnd: false }, words.discounts);
  });
};

/** 文ごとに、書いた合計が内訳の和と合わない所。一つの金額は一度だけ言う。 */
export const proseTotalMismatches = (source: string, sentences: readonly Span[], amounts: readonly Amount[], words: TotalWords): StructureIssue[] => {
  const issues = sentences.flatMap((sentence) => {
    const inSentence = inside(amounts, sentence.start, sentence.end);
    if (inSentence.length <= MIN_PARTS) return [];
    return [...totalsAfterParts(source, sentence, inSentence, words), ...totalsBeforeParts(source, sentence, inSentence, words)];
  });
  return issues.filter((issue, index) => issues.findIndex((other) => other.offset === issue.offset) === index);
};
