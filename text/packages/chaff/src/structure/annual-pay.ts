import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";

/**
 * annual-pay-mismatch: a job posting's example annual pay that is not the monthly pay times twelve plus the bonus months
 * (年収例 450万円 with 月給28万円 and 賞与 計3ヶ月分, where 28万 × 15 is 420万). The monthly pay and the bonus are the ones
 * written on the annual line itself (月給28万円の場合), else the one reading the rest of the document gives. Two different
 * readings, a reading that cannot be read plainly (a range of months, 各, 約, 以上, an open range) and an annual line or note
 * that mentions overtime or allowances all leave the figure unchecked. An annual salary (年俸) may hold the bonus or not,
 * so either is accepted. The words come from the lexicons. Pure.
 */

/** One amount of money as read: its currency, its value, and the value of the word of scale written in it (万), if any. */
export type PayAmount = {
  readonly offset: number;
  readonly end: number;
  readonly currency: string;
  readonly value: number;
  readonly scale: number | undefined;
};

export type LabelKind = "example" | "salary" | "monthly" | "pay" | "bonus";

export type PositionedWord = { readonly word: string; readonly position: "before" | "after" };

export type AnnualPayWords = {
  /** Labels by kind: an example annual pay (年収例), an annual salary (年俸), a monthly pay (月給), a pay that is monthly only beside a per-month word (給与), a bonus (賞与). */
  readonly labels: Readonly<Record<LabelKind, readonly string[]>>;
  /** Words that may stand between a label and its amount (は, of). */
  readonly links: readonly string[];
  /** Words that make a pay label monthly (a month, /月). */
  readonly perMonth: readonly string[];
  /** Words that say there is no bonus: after the label (なし, none) or before it (No bonus). */
  readonly none: readonly PositionedWord[];
  /** Words that make a bonus months count per payment (各, each); such a bonus is not read. */
  readonly each: readonly string[];
  /** Words of a bonus paid besides the stated one (別途, additional); such a bonus is not read. */
  readonly extra: readonly string[];
  /** Words that say a pay holds overtime or allowances (残業, 手当, overtime); such a pay is not compared. */
  readonly includes: readonly string[];
  /** Words that make an amount or a count open-ended or approximate (約, 以上, from, or more). */
  readonly markers: readonly PositionedWord[];
  /** The word of a month after a count (ヶ月, months). */
  readonly months: readonly string[];
  /** Marks and words that join the two ends of a range (〜, to). */
  readonly connectors: readonly string[];
  /** Numbers written as words (three) and their values. */
  readonly numberWords: readonly { readonly word: string; readonly value: number }[];
};

/** Two ends of a pay; a single amount has both ends the same. */
export type Ends = { readonly low: number; readonly high: number };

/** A pay as read: its ends, its currency, how it was written, and the rounding its written digits allow. */
export type PayReading = { readonly offset: number; readonly ends: Ends; readonly currency: string; readonly written: string; readonly unit: number };

export type BonusReading = { readonly months: number; readonly written: string };

/** A pay or a bonus that is stated but cannot be read plainly. */
type Unclear = { readonly unclear: true };
const UNCLEAR: Unclear = { unclear: true };

type Span = { readonly start: number; readonly end: number };
type Label = Span & { readonly kind: LabelKind };
type Count = Span & { readonly count: number; readonly marked: boolean };
type Scope = { readonly label: Label; readonly end: number };
type Context = { readonly text: string; readonly labels: readonly Label[]; readonly amounts: readonly PayAmount[]; readonly words: AnnualPayWords };
type Posting = { readonly monthly: PayReading | undefined; readonly bonus: BonusReading | undefined };

/** An annual pay written in plain digits ($72,000, 4,200,000円) may be rounded to a thousand of its currency. */
export const PLAIN_ROUNDING = 1000;
const MONTHS_A_YEAR = 12;
const KINDS: readonly LabelKind[] = ["example", "salary", "monthly", "pay", "bonus"];
const ANNUAL: readonly LabelKind[] = ["example", "salary"];
const BONUS_STOPS: readonly LabelKind[] = ["example", "salary", "bonus"];
/** How far from an amount or a count a marker (約, 以上) or the start of a range is looked for. */
const MARKER_REACH = 12;

const LATIN = /[A-Za-z]/u;
const SEPARATORS = /[\s|｜:：=＝、，,・/／'’()（）[\]［］-]/gu;
const PARENTHETICAL_WITHOUT_DIGITS = /[（(][^()（）0-9０-９]*[)）]/gu;
const SENTENCE_END = /[。！？；;]|[.!?](?=\s|$)/u;
const SENTENCE_SPLIT = /[。！？；;]|[.!?](?=\s)/u;
const RANGE_START = /[0-9０-９A-Za-z一二三四五六七八九十]\s*$/u;
const WORD_END = /[0-9A-Za-z]$/u;
const DIGITS = "[0-9０-９]+(?:[.．][0-9０-９]+)?";

const wordPattern = (word: string): string => {
  const edgeStart = LATIN.test(word.charAt(0)) ? "(?<![A-Za-z])" : "";
  const edgeEnd = LATIN.test(word.charAt(word.length - 1)) ? "(?![A-Za-z])" : "";
  return `${edgeStart}${escapeRegExp(word)}${edgeEnd}`;
};

/** One alternation of the words, longest first so 年収例 wins over 年収. Undefined when there are none. */
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

const contains = (text: string, words: readonly string[]): boolean => occurrences(text, words).length > 0;

/** Whether only separators, bracketed words without digits and the given words stand in the gap (「：」, " of "). */
export const isPlainGap = (gap: string, words: readonly string[]): boolean => {
  const pattern = alternation(words);
  const bare = gap.replace(PARENTHETICAL_WITHOUT_DIGITS, "");
  return (pattern === undefined ? bare : bare.replace(new RegExp(pattern, "giu"), "")).replace(SEPARATORS, "") === "";
};

/** Every label in document order with its kind, read in one pass so a longer label (Annual salary) hides a shorter one in it (salary). */
export const labelsIn = (text: string, words: AnnualPayWords): Label[] => {
  const kinds = new Map(KINDS.flatMap((kind) => words.labels[kind].map((label): [string, LabelKind] => [label.toLowerCase(), kind])));
  return occurrences(text, [...kinds.keys()]).flatMap((span) => {
    const kind = kinds.get(text.slice(span.start, span.end).toLowerCase());
    return kind === undefined ? [] : [{ ...span, kind }];
  });
};

const lineStart = (text: string, offset: number): number => text.lastIndexOf("\n", offset - 1) + 1;

const lineEnd = (text: string, offset: number): number => {
  const end = text.indexOf("\n", offset);
  return end === -1 ? text.length : end;
};

/** Where a label's statement ends: at the end of its sentence or line, or at the next label of one of the given kinds. */
const statementEnd = (text: string, label: Label, labels: readonly Label[], stops: readonly LabelKind[]): number => {
  const end = lineEnd(text, label.end);
  const sentence = SENTENCE_END.exec(text.slice(label.end, end));
  const next = labels.find((other) => other.start >= label.end && stops.includes(other.kind))?.start ?? end;
  return Math.min(end, next, sentence === null ? end : label.end + sentence.index);
};

/** The sentence a scope's label is in, from its start to the end of the scope. */
const sentenceOf = (text: string, scope: Scope): string => {
  const head = text.slice(lineStart(text, scope.label.start), scope.label.start).split(SENTENCE_SPLIT).at(-1) ?? "";
  return `${head}${text.slice(scope.label.start, scope.end)}`;
};

const amountsBetween = (amounts: readonly PayAmount[], start: number, end: number): PayAmount[] =>
  amounts.filter((amount) => amount.offset >= start && amount.end <= end);

const textBefore = (text: string, start: number): string =>
  text
    .slice(Math.max(0, start - MARKER_REACH), start)
    .trimEnd()
    .toLowerCase();

const textAfter = (text: string, end: number): string =>
  text
    .slice(end, end + MARKER_REACH)
    .trimStart()
    .toLowerCase();

/** Whether a marker stands right before the start (約450万円, about $72,000). */
const markedBefore = (text: string, start: number, words: AnnualPayWords): boolean => {
  const before = textBefore(text, start);
  return words.markers.some((marker) => marker.position === "before" && before.endsWith(marker.word.toLowerCase()));
};

/** Whether a marker stands right after the end (400万円以上, $70,000 or more), or a range is left open there (400万円〜). */
const markedAfter = (text: string, end: number, words: AnnualPayWords): boolean => {
  const after = textAfter(text, end);
  const marked = words.markers.some((marker) => marker.position === "after" && after.startsWith(marker.word.toLowerCase()));
  return marked || words.connectors.some((connector) => after.startsWith(connector.toLowerCase()));
};

const isMarked = (text: string, span: Span, words: AnnualPayWords): boolean => markedBefore(text, span.start, words) || markedAfter(text, span.end, words);

/** Whether a count or an amount is the upper end of a range (2〜3ヶ月, 2 to 3 months). */
const endsRange = (text: string, start: number, words: AnnualPayWords): boolean => {
  const before = text.slice(Math.max(0, start - MARKER_REACH), start).trimEnd();
  return words.connectors.some((connector) => before.endsWith(connector) && RANGE_START.test(before.slice(0, -connector.length)));
};

/** The second end of a range that starts with this amount (25万円〜30万円), if one follows; a reversed range is none. */
const rangeEnd = (text: string, first: PayAmount, next: PayAmount | undefined, words: AnnualPayWords): PayAmount | undefined => {
  if (next === undefined || next.currency !== first.currency || next.value < first.value) return undefined;
  const joint = text.slice(first.end, next.offset).trim().toLowerCase();
  return words.connectors.some((connector) => connector.toLowerCase() === joint) ? next : undefined;
};

const decimalsOf = (written: string): number => /[.．]([0-9０-９]+)/u.exec(written)?.[1]?.length ?? 0;

/** The rounding an amount's digits allow: one of its last written place with a word of scale (420万 to a 万), else a thousand. */
export const roundingOf = (amount: PayAmount, written: string): number =>
  amount.scale === undefined ? PLAIN_ROUNDING : amount.scale * 10 ** -decimalsOf(written);

const readingOf = (text: string, first: PayAmount, last: PayAmount): PayReading => ({
  offset: first.offset,
  ends: { low: first.value, high: last.value },
  currency: first.currency,
  written: text.slice(first.offset, last.end),
  unit: Math.max(roundingOf(first, text.slice(first.offset, first.end)), roundingOf(last, text.slice(last.offset, last.end))),
});

/**
 * The pay a label states up to the end: undefined when no amount is joined to the label, unclear when the amount is
 * followed by another, marked (約, 以上), left open, or stated with overtime or allowances.
 */
const payAt = (context: Context, label: Label, end: number): PayReading | Unclear | undefined => {
  const { text, words } = context;
  const [first, second, ...rest] = amountsBetween(context.amounts, label.end, end);
  if (first === undefined || !isPlainGap(text.slice(label.end, first.offset), words.links)) return undefined;
  const last = rangeEnd(text, first, second, words) ?? first;
  const others = rest.length > 0 || (second !== undefined && last !== second);
  const marked = isMarked(text, { start: first.offset, end: last.end }, words);
  if (others || marked || contains(text.slice(label.end, end), words.includes)) return UNCLEAR;
  return readingOf(text, first, last);
};

const numberWordValue = (word: string, words: AnnualPayWords): number | undefined =>
  words.numberWords.find((entry) => entry.word.toLowerCase() === word.toLowerCase())?.value;

const countOf = (written: string, words: AnnualPayWords): number => numberWordValue(written, words) ?? Number(written.normalize("NFKC"));

/** The months counts between start and end (3ヶ月, three months), each marked when it is approximate, open or a range's end. */
export const monthsIn = (text: string, start: number, end: number, words: AnnualPayWords): Count[] => {
  const marker = alternation(words.months);
  if (marker === undefined) return [];
  const numberWords = alternation(words.numberWords.map((entry) => entry.word));
  const count = numberWords === undefined ? DIGITS : `${DIGITS}|${numberWords}`;
  const pattern = new RegExp(`(?<![0-9０-９.,，．])(${count})\\s?(?:${marker})`, "giu");
  return [...text.slice(start, end).matchAll(pattern)].map((match) => {
    const span = { start: start + match.index, end: start + match.index + match[0].length };
    return { ...span, count: countOf(match[1] ?? "", words), marked: endsRange(text, span.start, words) || isMarked(text, span, words) };
  });
};

/** Where a word saying there is no bonus stands: right before the label (No bonus) or right after it (賞与：なし). */
const noneSpan = (text: string, label: Label, end: number, none: PositionedWord): Span | undefined => {
  if (none.position === "before") {
    const before = text.slice(lineStart(text, label.start), label.start).trimEnd();
    const start = before.length - none.word.length;
    const isWord = before.toLowerCase().endsWith(none.word.toLowerCase()) && !WORD_END.test(before.slice(0, start));
    return isWord ? { start: lineStart(text, label.start) + start, end: label.end } : undefined;
  }
  const [at] = occurrences(text.slice(label.end, end), [none.word]);
  return at !== undefined && isPlainGap(text.slice(label.end, label.end + at.start), []) ? { start: label.end + at.start, end: label.end + at.end } : undefined;
};

/** The words saying there is no bonus, as written (No bonus, なし). */
const noneAt = (text: string, label: Label, end: number, words: AnnualPayWords): string | undefined => {
  const span = words.none.map((none) => noneSpan(text, label, end, none)).find((found) => found !== undefined);
  return span === undefined ? undefined : text.slice(span.start, span.end);
};

/**
 * The bonus a label states up to the end: undefined when it states no months and no "none", unclear when it is per
 * payment (各), besides another (別途), given as an amount, approximate, a range, or two different counts.
 */
const bonusAt = (context: Context, label: Label, end: number): BonusReading | Unclear | undefined => {
  const { text, words } = context;
  const none = noneAt(text, label, end, words);
  if (none !== undefined) return { months: 0, written: none };
  const counts = monthsIn(text, label.end, end, words);
  const [first] = counts;
  if (first === undefined) return undefined;
  const piece = text.slice(label.end, end);
  const odd = contains(piece, [...words.each, ...words.extra]) || amountsBetween(context.amounts, label.end, end).length > 0;
  if (odd || counts.some((count) => count.marked || count.count !== first.count)) return UNCLEAR;
  return { months: first.count, written: text.slice(first.start, first.end) };
};

const isRead = <T extends object>(reading: T | Unclear): reading is T => !("unclear" in reading);

/** The one reading all agree on; undefined when there is none, one is unclear, or two differ. */
const agreed = <T extends object>(readings: readonly (T | Unclear)[], same: (left: T, right: T) => boolean): T | undefined => {
  const [first] = readings;
  if (first === undefined || !isRead(first)) return undefined;
  return readings.every((reading) => isRead(reading) && same(reading, first)) ? first : undefined;
};

const samePay = (left: PayReading, right: PayReading): boolean =>
  left.currency === right.currency && left.ends.low === right.ends.low && left.ends.high === right.ends.high;

const sameBonus = (left: BonusReading, right: BonusReading): boolean => left.months === right.months;

/** The monthly pays the labels state; a pay label (給与) counts only with a per-month word in its statement. */
const monthlyReadings = (context: Context, labels: readonly Label[]): (PayReading | Unclear)[] =>
  labels.flatMap((label) => {
    if (label.kind !== "monthly" && label.kind !== "pay") return [];
    const end = statementEnd(context.text, label, context.labels, KINDS);
    if (label.kind === "pay" && !contains(context.text.slice(label.end, end), context.words.perMonth)) return [];
    const reading = payAt(context, label, end);
    return reading === undefined ? [] : [reading];
  });

const bonusReadings = (context: Context, labels: readonly Label[]): (BonusReading | Unclear)[] =>
  labels.flatMap((label) => (label.kind === "bonus" ? (bonusAt(context, label, statementEnd(context.text, label, context.labels, BONUS_STOPS)) ?? []) : []));

/** Whether the annual pay is the monthly pay times one of the factors, end for end, within the annual pay's rounding. */
export const isAnnualOf = (annual: Ends, unit: number, monthly: Ends, factors: readonly number[]): boolean =>
  factors.some((factor) => Math.abs(annual.low - monthly.low * factor) < unit && Math.abs(annual.high - monthly.high * factor) < unit);

/** The months of pay a year: twelve and the bonus; an annual salary (年俸) may also leave the bonus out. */
export const factorsOf = (kind: LabelKind, salarySystem: boolean, bonusMonths: number): number[] =>
  kind === "salary" || salarySystem ? [MONTHS_A_YEAR, MONTHS_A_YEAR + bonusMonths] : [MONTHS_A_YEAR + bonusMonths];

const isRange = (ends: Ends): boolean => ends.low !== ends.high;

const inside = (labels: readonly Label[], scope: Scope): Label[] => labels.filter((label) => label.start > scope.label.start && label.start < scope.end);

const mismatchOf = (context: Context, scope: Scope, posting: Posting, salarySystem: boolean): StructureIssue[] => {
  const annual = payAt(context, scope.label, statementEnd(context.text, scope.label, context.labels, KINDS));
  if (annual === undefined || !isRead(annual)) return [];
  const own = inside(context.labels, scope);
  const ownMonthly = monthlyReadings(context, own);
  const ownBonus = bonusReadings(context, own);
  const monthly = ownMonthly.length > 0 ? agreed(ownMonthly, samePay) : posting.monthly;
  const bonus = ownBonus.length > 0 ? agreed(ownBonus, sameBonus) : posting.bonus;
  if (monthly === undefined || bonus === undefined || monthly.currency !== annual.currency) return [];
  if (isRange(annual.ends) !== isRange(monthly.ends)) return [];
  if (isAnnualOf(annual.ends, annual.unit, monthly.ends, factorsOf(scope.label.kind, salarySystem, bonus.months))) return [];
  const values = { annual: annual.written, monthly: monthly.written, bonus: bonus.written, months: MONTHS_A_YEAR + bonus.months };
  return [{ offset: annual.offset, values }];
};

/** Every annual pay that is not the posting's monthly pay times twelve plus its bonus months. */
export const annualPayMismatches = (text: string, amounts: readonly PayAmount[], words: AnnualPayWords): StructureIssue[] => {
  const labels = labelsIn(text, words);
  const scopes = labels.filter((label) => ANNUAL.includes(label.kind)).map((label) => ({ label, end: statementEnd(text, label, labels, ANNUAL) }));
  if (scopes.length === 0 || scopes.some((scope) => contains(sentenceOf(text, scope), words.includes))) return [];
  const context = { text, labels, amounts, words };
  const outside = labels.filter((label) => !scopes.some((scope) => label.start >= scope.label.start && label.start < scope.end));
  const posting = { monthly: agreed(monthlyReadings(context, outside), samePay), bonus: agreed(bonusReadings(context, outside), sameBonus) };
  const salarySystem = contains(text, words.labels.salary);
  return scopes.flatMap((scope) => mismatchOf(context, scope, posting, salarySystem));
};
