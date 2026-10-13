import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";
import {
  alternation,
  describe,
  hasWord,
  intervalOf,
  isPlainGap,
  isRough,
  isTotalOf,
  lineBounds,
  occurrences,
  sentenceAround,
  sumOf,
  writtenLike,
  type InstallmentAmount,
  type InstallmentWords,
  type Part,
} from "./installment-total.ts";

/**
 * installment-total-mismatch, the fee form: numbered instalments listed one per row or item (第1回：32,000円, | 1st
 * payment | £150 |, Final payment: $60) that do not add up to the fee stated in the same section (旅行代金は、1人あたり
 * 62,000円; "The trip costs £300 per student"). Compared only when the section states one fee, every instalment of the
 * series is read (numbered 1, 2, … with no gap or repeat, each with one plain amount), the section names a payment
 * (積立金, instalments), and every amount is in the fee's currency. A deposit counts only as an item of the series; one
 * named anywhere else stops the comparison. An instalment as large as the fee says the fee is per payment (a monthly
 * fee), not split, and is not compared. Words come from the lexicons. Pure.
 */

type Span = { readonly start: number; readonly end: number };

export type InstallmentSeriesWords = {
  /** Item labels with {n} for the instalment's number (第{n}回, {n} payment, Instalment {n}). */
  readonly numbered: readonly string[];
  /** Item labels of the last instalment, numbered after the others (最終回, Final payment). */
  readonly finals: readonly string[];
  /** Numbers written as words that {n} may be (first, 一) and their values. */
  readonly ordinals: readonly { readonly word: string; readonly value: number }[];
  /** Letters after a number that make it an ordinal (1st). */
  readonly ordinalSuffixes: readonly string[];
  /** Words that say the section is about paying (積立金, instalment); one must stand in the section. */
  readonly payments: readonly string[];
  /** A deposit (申込金, deposit): an item of the series, or a reason not to compare. */
  readonly deposits: readonly string[];
  /** Words that state the fee (旅行代金, costs). */
  readonly fees: readonly string[];
  /** Words that may stand between a fee word and its amount (1人あたり, per student). */
  readonly feeLinks: readonly string[];
};

/** One read item of a series: its number (undefined for a deposit, Infinity for a final one) and its amount. */
type Item = { readonly line: Span; readonly number: number | undefined; readonly amount: InstallmentAmount | undefined };

/** What may stand before an item label on its line: a table bar, a list mark, spaces. */
const ITEM_LEAD = /^[\s|｜\-*+・•]*$/u;
const DIGITS = "[0-9０-９]+";
const FINAL = Number.POSITIVE_INFINITY;

const numberPattern = (series: InstallmentSeriesWords): string => {
  const suffix = alternation(series.ordinalSuffixes);
  const words = alternation(series.ordinals.map((entry) => entry.word));
  const digits = suffix === undefined ? DIGITS : `${DIGITS}(?:${suffix})?`;
  return words === undefined ? digits : `${digits}|${words}`;
};

const numberOf = (written: string, series: InstallmentSeriesWords): number | undefined => {
  const digits = /^[0-9０-９]+/u.exec(written)?.[0];
  if (digits !== undefined) return Number(digits.normalize("NFKC"));
  return series.ordinals.find((entry) => entry.word.toLowerCase() === written.toLowerCase())?.value;
};

const labelRegExp = (label: string, number: string): RegExp => {
  const [before = "", after = ""] = label.split("{n}").map(escapeRegExp);
  const edgeStart = /^[A-Za-z]/u.test(label) ? "(?<![A-Za-z])" : "";
  const edgeEnd = /[A-Za-z]$/u.test(label) ? "(?![A-Za-z])" : "";
  return new RegExp(`${edgeStart}${before}(${number})${after}${edgeEnd}`, "giu");
};

type Label = Span & { readonly number: number | undefined };

const numberedLabels = (text: string, series: InstallmentSeriesWords): Label[] =>
  series.numbered.flatMap((label) =>
    [...text.matchAll(labelRegExp(label, numberPattern(series)))].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
      number: numberOf(match[1] ?? "", series),
    })),
  );

const wordLabels = (text: string, words: readonly string[], number: number | undefined): Label[] =>
  occurrences(text, words).map((span) => ({ ...span, number }));

const startsItem = (text: string, label: Span): boolean => ITEM_LEAD.test(text.slice(lineBounds(text, label.start).start, label.start));

/** The longest label at each place wins (Final payment over a bare payment), and only labels that open a row or an item. */
const itemLabels = (text: string, series: InstallmentSeriesWords): Label[] => {
  const all = [...numberedLabels(text, series), ...wordLabels(text, series.finals, FINAL), ...wordLabels(text, series.deposits, undefined)];
  const longest = all.filter(
    (label) =>
      !all.some((other) => other !== label && other.start <= label.start && other.end >= label.end && other.end - other.start > label.end - label.start),
  );
  return longest.filter((label) => startsItem(text, label)).toSorted((left, right) => left.start - right.start);
};

/** A label's amount: the one amount of its line, after a gap of separators, links and payment words; else unread. */
const itemOf = (text: string, label: Label, amounts: readonly InstallmentAmount[], words: InstallmentWords, series: InstallmentSeriesWords): Item => {
  const line = lineBounds(text, label.start);
  const onLine = amounts.filter((amount) => amount.offset >= label.end && amount.end <= line.end);
  const [amount] = onLine;
  const read =
    onLine.length === 1 &&
    amount !== undefined &&
    isPlainGap(text.slice(label.end, amount.offset), [...words.links, ...series.payments]) &&
    !isRough(text, { start: amount.offset, end: amount.end }, words);
  return { line, number: label.number, amount: read ? amount : undefined };
};

/** Whether the numbered items run 1, 2, …, k (a final one only last), each read; deposits may stand anywhere. */
export const isWholeSeries = (items: readonly Item[]): boolean => {
  const numbers = items.flatMap((item) => (item.number === undefined ? [] : [item.number]));
  const finalAt = numbers.indexOf(FINAL);
  const counted = numbers.filter((number) => number !== FINAL);
  const inOrder = counted.every((number, index) => number === index + 1);
  const finalLast = finalAt === -1 || finalAt === numbers.length - 1;
  return items.length >= 2 && counted.length >= 1 && inOrder && finalLast && items.every((item) => item.amount !== undefined);
};

/** The sections of the text: from one heading to the next; the whole text when there are none. */
export const sectionsOf = (text: string, headingStarts: readonly number[]): Span[] => {
  const starts = [0, ...headingStarts.filter((start) => start > 0 && start < text.length).toSorted((left, right) => left - right)];
  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? text.length }));
};

/** Every fee the section states: a fee word, then only separators, links and per-person words before an amount. */
export const feesIn = (
  text: string,
  section: Span,
  amounts: readonly InstallmentAmount[],
  words: InstallmentWords,
  series: InstallmentSeriesWords,
): InstallmentAmount[] => {
  const body = text.slice(section.start, section.end);
  return occurrences(body, series.fees).flatMap((span) => {
    const at = { start: section.start + span.start, end: section.start + span.end };
    const sentence = sentenceAround(text, at);
    const amount = amounts.find((candidate) => candidate.offset >= at.end && candidate.end <= sentence.end);
    if (amount === undefined || !isPlainGap(text.slice(at.end, amount.offset), [...words.links, ...series.feeLinks])) return [];
    return [amount];
  });
};

const within = (span: Span, section: Span): boolean => span.start >= section.start && span.end <= section.end;

const sameAmount = (left: InstallmentAmount, right: InstallmentAmount): boolean => left.value === right.value && left.currency === right.currency;

const partOf = (text: string, amount: InstallmentAmount): Part => ({ count: 1, amount, written: text.slice(amount.offset, amount.end) });

/** The comparison of one section: its series of instalments against its one fee; undefined when anything is not read. */
const sectionIssue = (
  text: string,
  section: Span,
  items: readonly Item[],
  amounts: readonly InstallmentAmount[],
  words: InstallmentWords,
  series: InstallmentSeriesWords,
): StructureIssue | undefined => {
  const own = items.filter((item) => within(item.line, section));
  if (!isWholeSeries(own) || !hasWord(text.slice(section.start, section.end), series.payments)) return undefined;
  const fees = feesIn(text, section, amounts, words, series).filter((fee) => !own.some((item) => within({ start: fee.offset, end: fee.end }, item.line)));
  const [fee] = fees;
  if (fee === undefined || !fees.every((other) => sameAmount(other, fee)) || isRough(text, { start: fee.offset, end: fee.end }, words)) return undefined;
  const parts = own.flatMap((item) => (item.amount === undefined ? [] : [partOf(text, item.amount)]));
  const [first] = parts;
  if (first === undefined || parts.some((part) => part.amount.currency !== fee.currency || part.amount.value >= fee.value)) return undefined;
  const written = text.slice(fee.offset, fee.end);
  const sum = sumOf(parts);
  const stated = fee.scale === undefined ? { low: fee.value, high: fee.value } : intervalOf(fee, written);
  if (isTotalOf(stated, sum)) return undefined;
  return { offset: first.amount.offset, values: { payments: describe(parts), sum: writtenLike((sum.low + sum.high) / 2, first), total: written } };
};

/** Whether a deposit is named outside the items of a series: then whether it is part of the fee cannot be read. */
const depositOutside = (text: string, items: readonly Item[], series: InstallmentSeriesWords): boolean =>
  occurrences(text, series.deposits).some((span) => !items.some((item) => item.number === undefined && within(span, item.line)));

/** Every section whose numbered instalments do not add up to its stated fee; reported at the first instalment. */
export const installmentFeeMismatches = (
  text: string,
  amounts: readonly InstallmentAmount[],
  headingStarts: readonly number[],
  words: InstallmentWords,
  series: InstallmentSeriesWords,
): StructureIssue[] => {
  const items = itemLabels(text, series).map((label) => itemOf(text, label, amounts, words, series));
  if (items.length < 2 || depositOutside(text, items, series)) return [];
  return sectionsOf(text, headingStarts).flatMap((section) => {
    const issue = sectionIssue(text, section, items, amounts, words, series);
    return issue === undefined ? [] : [issue];
  });
};
