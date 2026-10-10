import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";

/**
 * installment-total-mismatch: a number of payments times the amount of each that is not the stated total of payments
 * (お支払回数 60回、毎月のお支払額 32,800円、お支払総額 1,968,000円; "48 monthly payments of $537.50; total of payments
 * $25,800"). A first or a final payment stated apart is added as written: first + (n − 2) × each + last. The plan is read
 * from labels (each kind stated once, or always with the same value) or, without them, from the payments of one sentence
 * (47 payments of $550.53 and 1 payment of $550.71), when only one of them repeats (two repeated ones are choices). Each repeated payment may be rounded by half its last written digit.
 * An approximate amount, a range, two different values of one kind, a word that adds payments of another kind (bonus,
 * balloon, down payment), and a stated rounding with no first or final payment are not compared. Words come from the
 * lexicons. Pure.
 */

/** One amount of money as read: its currency, its value, and the value of the word of scale written in it (万), if any. */
export type InstallmentAmount = {
  readonly offset: number;
  readonly end: number;
  readonly currency: string;
  readonly value: number;
  readonly scale: number | undefined;
};

export type PositionedWord = { readonly word: string; readonly position: "before" | "after" };

export type InstallmentWords = {
  readonly labels: {
    /** The number of payments (お支払回数, Number of payments). */
    readonly count: readonly string[];
    /** The amount of each regular payment (毎月のお支払額, 2回目以降, Monthly payment). */
    readonly each: readonly string[];
    /** A first payment stated apart (初回, First payment). */
    readonly first: readonly string[];
    /** A final payment stated apart (最終回, Final payment). */
    readonly last: readonly string[];
    /** The total of all payments (お支払総額, Total of payments). */
    readonly total: readonly string[];
  };
  /** Words after a count that make it a number of payments (回, payments). */
  readonly units: readonly string[];
  /** Words that may stand between a count and its unit (monthly, equal). */
  readonly qualifiers: readonly string[];
  /** Words that may stand between a label and its value (は, の, is). */
  readonly links: readonly string[];
  /** Words that join a count of payments to the amount of each (of, at, ×). */
  readonly per: readonly string[];
  /** Words that say a payment absorbs a remainder (端数, adjusted). */
  readonly rounding: readonly string[];
  /** Words of payments outside the plan (ボーナス, balloon, down payment); a document with one is not compared. */
  readonly skips: readonly string[];
  /** Marks of a rough amount (約, about). */
  readonly markers: readonly PositionedWord[];
  /** Marks and words that join the two ends of a range (〜, to). */
  readonly connectors: readonly string[];
  /** Numbers written as words (forty-eight is not one; twelve is) and their values. */
  readonly numberWords: readonly { readonly word: string; readonly value: number }[];
};

type Span = { readonly start: number; readonly end: number };
type Interval = { readonly low: number; readonly high: number };
type LabelKind = keyof InstallmentWords["labels"];

/** A labelled value: an interval of money, a count, or undefined when the statement is not one plain value. */
type Field = {
  readonly kind: LabelKind;
  readonly label: Span;
  readonly amount: InstallmentAmount | undefined;
  readonly count: number | undefined;
  readonly clear: boolean;
};

/** One part of a plan: this many payments of this amount. */
export type Part = { readonly count: number; readonly amount: InstallmentAmount; readonly written: string };

const LABEL_KINDS: readonly LabelKind[] = ["count", "each", "first", "last", "total"];
const LATIN = /[A-Za-z]/u;
const SEPARATORS = /[\s|｜:：=＝、，,・()（）[\]［］]/gu;
const SENTENCE_END = /[。！？；;]|[.!?](?=\s|$)/gu;
const DIGITS = "[0-9０-９]+";
/** Floating point slack when amounts with cents are multiplied and added. */
const EPSILON = 1e-6;

const wordPattern = (word: string): string => {
  const edgeStart = LATIN.test(word.charAt(0)) ? "(?<![A-Za-z])" : "";
  const edgeEnd = LATIN.test(word.charAt(word.length - 1)) ? "(?![A-Za-z])" : "";
  return `${edgeStart}${escapeRegExp(word)}${edgeEnd}`;
};

/** One alternation of the words, longest first so 初回お支払額 wins over 初回. Undefined when there are none. */
const alternation = (words: readonly string[]): string | undefined =>
  words.length === 0
    ? undefined
    : words
        .toSorted((left, right) => right.length - left.length)
        .map(wordPattern)
        .join("|");

const occurrences = (text: string, words: readonly string[]): Span[] => {
  const pattern = alternation(words);
  if (pattern === undefined) return [];
  return [...text.matchAll(new RegExp(pattern, "giu"))].map((match) => ({ start: match.index, end: match.index + match[0].length }));
};

const withoutWords = (text: string, words: readonly string[]): string => {
  const pattern = alternation(words);
  return pattern === undefined ? text : text.replace(new RegExp(pattern, "giu"), "");
};

/** Whether only separators and these words stand in a gap on one line (「：」, "の", " of "). */
export const isPlainGap = (gap: string, words: readonly string[]): boolean => !gap.includes("\n") && withoutWords(gap, words).replace(SEPARATORS, "") === "";

const lineBounds = (text: string, offset: number): Span => {
  const end = text.indexOf("\n", offset);
  return { start: text.lastIndexOf("\n", offset - 1) + 1, end: end === -1 ? text.length : end };
};

/** The sentence around a span, within its line. */
export const sentenceAround = (text: string, span: Span): Span => {
  const line = lineBounds(text, span.start);
  const ends = [...text.slice(line.start, line.end).matchAll(SENTENCE_END)].map((match) => line.start + match.index);
  const start = ends.filter((end) => end < span.start).at(-1);
  return { start: start === undefined ? line.start : start + 1, end: ends.find((at) => at >= span.end) ?? line.end };
};

const decimalsOf = (written: string): number => /[.．]([0-9０-９]+)/u.exec(written)?.[1]?.length ?? 0;

/** The interval a payment's digits allow: half its last written digit either way (9.8万 is 97,500 to 98,500; $550.53 ± half a cent). */
export const intervalOf = (amount: InstallmentAmount, written: string): Interval => {
  const half = ((amount.scale ?? 1) * 10 ** -decimalsOf(written)) / 2;
  return { low: amount.value - half, high: amount.value + half };
};

/** The stated total's interval: exact for plain digits, half the last digit of a word of scale (196.8万). */
const totalInterval = (amount: InstallmentAmount, written: string): Interval =>
  amount.scale === undefined ? { low: amount.value, high: amount.value } : intervalOf(amount, written);

const countOf = (written: string, words: InstallmentWords): number =>
  words.numberWords.find((entry) => entry.word.toLowerCase() === written.toLowerCase())?.value ?? Number(written.normalize("NFKC"));

const countPattern = (words: InstallmentWords): string => {
  const numberWords = alternation(words.numberWords.map((entry) => entry.word));
  return numberWords === undefined ? DIGITS : `${DIGITS}|${numberWords}`;
};

const hasWord = (text: string, words: readonly string[]): boolean => occurrences(text, words).length > 0;

/** How far around a value its marks are looked for. */
const MARK_REACH = 16;

/** The text just before a value on its line. */
const beforeOnLine = (text: string, value: Span): string => text.slice(Math.max(lineBounds(text, value.start).start, value.start - MARK_REACH), value.start);

/** The text just after a value on its line. */
const afterOnLine = (text: string, value: Span): string => text.slice(value.end, Math.min(lineBounds(text, value.start).end, value.end + MARK_REACH));

/** Whether a rough mark stands right before or after the value (約 32,800円, 60回程度, about $540). */
const isMarked = (text: string, value: Span, markers: readonly PositionedWord[]): boolean => {
  const before = beforeOnLine(text, value).trimEnd().toLowerCase();
  const after = afterOnLine(text, value).trimStart().toLowerCase();
  return markers.some((marker) => (marker.position === "before" ? before.endsWith(marker.word.toLowerCase()) : after.startsWith(marker.word.toLowerCase())));
};

/** Whether a range connector follows the value with another number (32,800円〜33,000円, $540 to $560). */
const opensRange = (text: string, value: Span, connectors: readonly string[]): boolean => {
  const after = afterOnLine(text, value).trimStart().toLowerCase();
  return connectors.some((connector) => after.startsWith(connector.toLowerCase()) && /^\s*[$€£¥￥0-9０-９]/u.test(after.slice(connector.length)));
};

const isRough = (text: string, value: Span, words: InstallmentWords): boolean =>
  isMarked(text, value, words.markers) || opensRange(text, value, words.connectors);

type Label = Span & { readonly kind: LabelKind };

/** Every label of the plan in document order, with its kind; the longest label wins (初回お支払額 over 初回). */
export const labelsIn = (text: string, words: InstallmentWords): Label[] => {
  const entries: [string, LabelKind][] = LABEL_KINDS.flatMap((kind) => words.labels[kind].map((word): [string, LabelKind] => [word.toLowerCase(), kind]));
  const kindOf = new Map(entries);
  return occurrences(text, [...kindOf.keys()]).flatMap((span) => {
    const kind = kindOf.get(text.slice(span.start, span.end).toLowerCase());
    return kind === undefined ? [] : [{ ...span, kind }];
  });
};

/** Where a label's own value must be: before the next label, the end of the sentence, or the end of the line. */
const stretchOf = (text: string, label: Label, next: Label | undefined): Span => {
  const sentence = sentenceAround(text, label);
  return { start: label.end, end: Math.min(sentence.end, next?.start ?? sentence.end) };
};

const amountsWithin = (amounts: readonly InstallmentAmount[], span: Span): InstallmentAmount[] =>
  amounts.filter((amount) => amount.offset >= span.start && amount.end <= span.end);

/** A count label's number (お支払回数：60回, Number of payments: 48); not clear when rough or followed by money. */
const countField = (text: string, label: Label, stretch: Span, amounts: readonly InstallmentAmount[], words: InstallmentWords): Field[] => {
  const match = new RegExp(`(?<![0-9０-９.,])(${countPattern(words)})(?![0-9０-９]|[.,．，][0-9０-９])`, "iu").exec(text.slice(stretch.start, stretch.end));
  if (match === null || !isPlainGap(text.slice(stretch.start, stretch.start + match.index), words.links)) return [];
  const span = { start: stretch.start + match.index, end: stretch.start + match.index + match[0].length };
  const clear = !isRough(text, span, words) && amountsWithin(amounts, stretch).length === 0;
  return [{ kind: label.kind, label, amount: undefined, count: countOf(match[1] ?? "", words), clear }];
};

/** A money label's amount (毎月のお支払額：32,826円); not clear when rough or when the statement holds a second amount. */
const amountField = (text: string, label: Label, stretch: Span, amounts: readonly InstallmentAmount[], words: InstallmentWords): Field[] => {
  const [first, ...rest] = amountsWithin(amounts, stretch);
  if (first === undefined || !isPlainGap(text.slice(stretch.start, first.offset), words.links)) return [];
  const clear = rest.length === 0 && !isRough(text, { start: first.offset, end: first.end }, words);
  return [{ kind: label.kind, label, amount: first, count: undefined, clear }];
};

/** Every label followed by its own value, in document order. */
export const fieldsIn = (text: string, amounts: readonly InstallmentAmount[], words: InstallmentWords): Field[] => {
  const labels = labelsIn(text, words);
  return labels.flatMap((label, index) => {
    const stretch = stretchOf(text, label, labels[index + 1]);
    return label.kind === "count" ? countField(text, label, stretch, amounts, words) : amountField(text, label, stretch, amounts, words);
  });
};

const sameValue = (left: Field, right: Field): boolean =>
  left.count === right.count && left.amount?.value === right.amount?.value && left.amount?.currency === right.amount?.currency;

/** The one value a kind has in the document: undefined when it is missing, unclear, or stated twice with different values. */
const soleField = (fields: readonly Field[], kind: LabelKind): Field | undefined => {
  const ofKind = fields.filter((field) => field.kind === kind);
  const [first] = ofKind;
  return first !== undefined && ofKind.every((field) => field.clear && sameValue(field, first)) ? first : undefined;
};

const isStated = (fields: readonly Field[], kind: LabelKind): boolean => fields.some((field) => field.kind === kind);

const partOf = (text: string, count: number, amount: InstallmentAmount): Part => ({ count, amount, written: text.slice(amount.offset, amount.end) });

/** The parts a labelled plan states: the first and the final payment apart, each regular payment for the rest. */
const labelledParts = (text: string, fields: readonly Field[]): Part[] | undefined => {
  const count = soleField(fields, "count")?.count;
  const each = soleField(fields, "each")?.amount;
  const [first, last] = [soleField(fields, "first")?.amount, soleField(fields, "last")?.amount];
  if (count === undefined || each === undefined) return undefined;
  if ((isStated(fields, "first") && first === undefined) || (isStated(fields, "last") && last === undefined)) return undefined;
  const ends = [first, last].filter((amount) => amount !== undefined);
  const regular = count - ends.length;
  if (regular < 1) return undefined;
  const firstPart = first === undefined ? [] : [partOf(text, 1, first)];
  return [...firstPart, partOf(text, regular, each), ...(last === undefined ? [] : [partOf(text, 1, last)])];
};

/** A count of payments with its unit (48 monthly payments, 59回), and its value. */
const paymentCountsIn = (text: string, words: InstallmentWords): (Span & { readonly count: number })[] => {
  const unit = alternation(words.units);
  if (unit === undefined) return [];
  const qualifier = alternation(words.qualifiers);
  const between = qualifier === undefined ? "\\s?" : `\\s?(?:(?:${qualifier})\\s+)*`;
  const pattern = new RegExp(`(?<![0-9０-９.,，．])(${countPattern(words)})${between}(?:${unit})`, "giu");
  return [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length, count: countOf(match[1] ?? "", words) }));
};

/** Whether a gap joins a count of payments to its amount: a word of "each" (of, ×) and nothing but separators and links. */
const joinsPayment = (gap: string, words: InstallmentWords): boolean => hasWord(gap, words.per) && isPlainGap(gap, [...words.per, ...words.links]);

/** The amount a count of payments is of: right after it (48 payments of $537.50) or right before it (32,800円×59回). */
const amountOfCount = (text: string, count: Span, amounts: readonly InstallmentAmount[], words: InstallmentWords): InstallmentAmount | undefined => {
  const after = amounts.find((amount) => amount.offset >= count.end);
  if (after !== undefined && joinsPayment(text.slice(count.end, after.offset), words)) return after;
  const before = amounts.findLast((amount) => amount.end <= count.start);
  return before !== undefined && joinsPayment(text.slice(before.end, count.start), words) ? before : undefined;
};

/** Every count of payments joined to an amount, as a part of a plan. */
export const paymentPhrasesIn = (text: string, amounts: readonly InstallmentAmount[], words: InstallmentWords): Part[] =>
  paymentCountsIn(text, words).flatMap((count) => {
    const amount = amountOfCount(text, count, amounts, words);
    return amount === undefined || isRough(text, { start: amount.offset, end: amount.end }, words) ? [] : [partOf(text, count.count, amount)];
  });

/** Whether parts can be one plan: one repeated payment, the others single (a first or final payment); two repeated ones are choices. */
export const isOnePlan = (parts: readonly Part[]): boolean => parts.filter((part) => part.count > 1).length === 1;

/** The parts of the one sentence that states payments; undefined when none does, or two sentences state different plans. */
const phraseParts = (text: string, amounts: readonly InstallmentAmount[], words: InstallmentWords): Part[] | undefined => {
  const phrases = paymentPhrasesIn(text, amounts, words);
  const sentenceOf = (part: Part): number => sentenceAround(text, { start: part.amount.offset, end: part.amount.end }).start;
  const starts = [...new Set(phrases.map(sentenceOf))];
  const plans = starts.map((start) => phrases.filter((part) => sentenceOf(part) === start));
  const [plan] = plans;
  const key = (parts: readonly Part[]): string => parts.map((part) => `${String(part.count)}×${String(part.amount.value)}`).join("+");
  return plan !== undefined && isOnePlan(plan) && plans.every((other) => key(other) === key(plan)) ? plan : undefined;
};

/** The plan's parts: from its labels when it labels a count and a regular payment, else from one sentence of payments. */
export const planParts = (text: string, fields: readonly Field[], amounts: readonly InstallmentAmount[], words: InstallmentWords): Part[] | undefined => {
  if (isStated(fields, "count") && isStated(fields, "each")) return labelledParts(text, fields);
  const parts = phraseParts(text, amounts, words);
  const count = soleField(fields, "count")?.count;
  if (parts === undefined || (isStated(fields, "count") && count !== parts.reduce((sum, part) => sum + part.count, 0))) return undefined;
  return parts;
};

/** The interval the payments add up to. */
export const sumOf = (parts: readonly Part[]): Interval =>
  parts.reduce(
    (sum, part) => {
      const interval = intervalOf(part.amount, part.written);
      return { low: sum.low + part.count * interval.low, high: sum.high + part.count * interval.high };
    },
    { low: 0, high: 0 },
  );

/** Whether the stated total can be the sum of the payments, within their written precision. */
export const isTotalOf = (total: Interval, sum: Interval): boolean => total.high >= sum.low - EPSILON && total.low <= sum.high + EPSILON;

/** The sum written as the regular payment is written ($26,649.44, 1,971,720円); the bare number when it has a word of scale. */
export const writtenLike = (value: number, part: Part): string => {
  const decimals = part.amount.scale === undefined ? decimalsOf(part.written) : 0;
  const digits = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return part.amount.scale === undefined ? part.written.replace(/[0-9０-９][0-9０-９,，.．]*/u, digits) : digits;
};

const describe = (parts: readonly Part[]): string =>
  parts.map((part) => (part.count === 1 ? part.written : `${part.written} × ${String(part.count)}`)).join(" + ");

const regularOf = (parts: readonly Part[]): Part | undefined => parts.toSorted((left, right) => right.count - left.count)[0];

/** Whether something in the document stops the comparison: a payment of another kind, or a stated rounding with no payment apart. */
const isOutOfReach = (text: string, fields: readonly Field[], parts: readonly Part[], words: InstallmentWords): boolean =>
  hasWord(text, words.skips) || (hasWord(text, words.rounding) && parts.length === 1 && !isStated(fields, "first") && !isStated(fields, "last"));

/** The stated total of payments, when the document states one total once (or always the same). */
const statedTotal = (fields: readonly Field[]): InstallmentAmount | undefined => soleField(fields, "total")?.amount;

/** Every plan whose payments do not add up to its stated total of payments; reported at the regular payment. */
export const installmentTotalMismatches = (text: string, amounts: readonly InstallmentAmount[], words: InstallmentWords): StructureIssue[] => {
  const fields = fieldsIn(text, amounts, words);
  const total = statedTotal(fields);
  const parts = total === undefined ? undefined : planParts(text, fields, amounts, words);
  const regular = parts === undefined ? undefined : regularOf(parts);
  if (total === undefined || parts === undefined || regular === undefined || isOutOfReach(text, fields, parts, words)) return [];
  if (parts.some((part) => part.amount.currency !== total.currency)) return [];
  const written = text.slice(total.offset, total.end);
  const sum = sumOf(parts);
  if (isTotalOf(totalInterval(total, written), sum)) return [];
  const values = { payments: describe(parts), sum: writtenLike((sum.low + sum.high) / 2, regular), total: written };
  return [{ offset: regular.amount.offset, values }];
};
