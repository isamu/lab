import type { StructureIssue } from "./issues.ts";
import { alternation, intervalOf, isMultiple, isPlainGap, nearestStated, occurrences, type Interval, type StatedAmount } from "./stated-multiple.ts";

/**
 * rent-multiple-mismatch: a deposit, key money or guarantee given both as a number of months of rent and as an amount that
 * is not that many months of the listing's rent (敷金 2か月（98,000円） with 賃料 98,000円; "Deposit: Six months' rent
 * ($145,000)" with Rent $21,500). The rent is the nearest one stated before the deposit (several listings on one page each
 * state their own); a document whose deposits come before any rent uses the rent only when it states one. When the document
 * also states a fee beside the rent (管理費, service charge), the multiple may be of the rent alone or of the rent and the
 * fee, since listings do both and seldom say which. A months count without an amount, an amount without a months count, a
 * range of months, and two different pairs in one statement are not compared. The words come from the lexicons. Pure.
 */

export type RentMultipleWords = {
  /** Labels of the monthly rent (賃料, Rent). */
  readonly rents: readonly string[];
  /** Labels of a monthly fee paid with the rent (管理費, Service charge). */
  readonly fees: readonly string[];
  /** Labels of an amount stated in months of rent (敷金, 礼金, Security deposit). */
  readonly multiples: readonly string[];
  /** The word of a month after a count (か月, months). */
  readonly months: readonly string[];
  /** Words that may stand between a label or a months count and its amount (は, 分, of, equal to). */
  readonly links: readonly string[];
  /** Words that say an amount is not per month (per week, 年額, per sq ft); a rent line with one is not read. */
  readonly periods: readonly string[];
  /** Words that make the amount something other than the plain multiple (税込, tax included). */
  readonly skips: readonly string[];
  /** Marks and words that join the two ends of a range (〜, to). */
  readonly connectors: readonly string[];
  /** Numbers written as words (six, 一) and their values. */
  readonly numberWords: readonly { readonly word: string; readonly value: number }[];
};

/** A rent or fee as stated. range is undefined when the label has amounts that are not one monthly amount (a change, per week). */
type Stated = { readonly offset: number; readonly currency: string; readonly range: Interval | undefined; readonly written: string };

type Months = { readonly start: number; readonly end: number; readonly count: number };

const RANGE_START = /[0-9０-９A-Za-z一二三四五六七八九十]\s*$/u;
const SENTENCE_END = /[。！？；;]|[.!?](?=\s|$)/u;
const DIGITS = "[0-9０-９]+(?:[.．][0-9０-９]+)?";

const lineBounds = (text: string, offset: number): { readonly start: number; readonly end: number } => {
  const end = text.indexOf("\n", offset);
  return { start: text.lastIndexOf("\n", offset - 1) + 1, end: end === -1 ? text.length : end };
};

const amountsBetween = (amounts: readonly StatedAmount[], start: number, end: number): StatedAmount[] =>
  amounts.filter((amount) => amount.offset >= start && amount.end <= end);

/** A label preceded by a months count (2 months' rent, First month's rent) names a multiple, not the rent. */
const followsMonths = (before: string, words: RentMultipleWords): boolean => {
  const trimmed = before.replace(/['’]s?\s*$/u, "").trimEnd();
  return words.months.some((month) => trimmed.toLowerCase().endsWith(month.toLowerCase()));
};

/** The second end of a range that starts with this amount (85,000円〜90,000円), if one follows. */
const rangeEnd = (text: string, first: StatedAmount, next: StatedAmount | undefined, words: RentMultipleWords): StatedAmount | undefined => {
  if (next === undefined || next.currency !== first.currency || next.value < first.value) return undefined;
  const joint = text.slice(first.end, next.offset).trim();
  return words.connectors.some((connector) => connector.toLowerCase() === joint.toLowerCase()) ? next : undefined;
};

/** Where a label's own amount must be: before the next label of any kind on its line (賃料 98,000円 管理費 6,000円). */
const labelledEnd = (text: string, from: number, lineEnd: number, words: RentMultipleWords): number => {
  const [next] = occurrences(text.slice(from, lineEnd), [...words.rents, ...words.fees, ...words.multiples]);
  return next === undefined ? lineEnd : from + next.start;
};

/**
 * A rent or fee stated with one amount or one range of amounts. With a second amount (a change from one to another, two
 * units) or a word of another period on the line (per week, 年額), it is stated but its monthly amount is not known.
 */
const statedAt = (
  text: string,
  label: { readonly start: number; readonly end: number },
  amounts: readonly StatedAmount[],
  words: RentMultipleWords,
): Stated[] => {
  const line = lineBounds(text, label.start);
  const [first, second, ...rest] = amountsBetween(amounts, label.end, labelledEnd(text, label.end, line.end, words));
  if (first === undefined || !isPlainGap(text.slice(label.end, first.offset), words.links)) return [];
  if (followsMonths(text.slice(line.start, label.start), words)) return [];
  const last = rangeEnd(text, first, second, words) ?? first;
  const written = text.slice(first.offset, last.end);
  const unclear = (second !== undefined && last !== second) || rest.length > 0 || occurrences(text.slice(line.start, line.end), words.periods).length > 0;
  if (unclear) return [{ offset: label.start, currency: first.currency, range: undefined, written }];
  const range = { low: intervalOf(first, text.slice(first.offset, first.end)).low, high: intervalOf(last, text.slice(last.offset, last.end)).high };
  return [{ offset: label.start, currency: first.currency, range, written }];
};

/** Each label of the kind followed on its line by an amount (賃料 | 98,000円, Rent: $1,600 to $1,700), in document order. */
const statedAmounts = (text: string, labels: readonly string[], amounts: readonly StatedAmount[], words: RentMultipleWords): Stated[] =>
  occurrences(text, labels).flatMap((label) => statedAt(text, label, amounts, words));

const numberWordValue = (word: string, words: RentMultipleWords): number | undefined =>
  words.numberWords.find((entry) => entry.word.toLowerCase() === word.toLowerCase())?.value;

const countOf = (written: string, words: RentMultipleWords): number => numberWordValue(written, words) ?? Number(written.normalize("NFKC"));

/** The months counts in a piece of text (2か月, Six months), with the offset of the piece. */
export const monthsIn = (piece: string, offset: number, words: RentMultipleWords): Months[] => {
  const marker = alternation(words.months);
  if (marker === undefined) return [];
  const numberWords = alternation(words.numberWords.map((entry) => entry.word));
  const count = numberWords === undefined ? DIGITS : `${DIGITS}|${numberWords}`;
  const pattern = new RegExp(`(?<![0-9０-９.,，．])(${count})\\s?(?:${marker})`, "giu");
  return [...piece.matchAll(pattern)].map((match) => ({
    start: offset + match.index,
    end: offset + match.index + match[0].length,
    count: countOf(match[1] ?? "", words),
  }));
};

/** Whether a months count is the upper end of a range (1〜2か月). */
const endsRange = (text: string, months: Months, words: RentMultipleWords): boolean => {
  const before = text.slice(Math.max(0, months.start - 12), months.start).trimEnd();
  return words.connectors.some((connector) => before.endsWith(connector) && RANGE_START.test(before.slice(0, -connector.length)));
};

type Pair = { readonly months: Months; readonly amount: StatedAmount };

const gapBetween = (text: string, months: Months, amount: StatedAmount): string =>
  amount.offset >= months.end ? text.slice(months.end, amount.offset) : text.slice(amount.end, months.start);

/** A months count and an amount standing together, either way round (1か月（98,000円）, $3,200 (2 months' rent)). */
const pairsIn = (text: string, months: readonly Months[], amounts: readonly StatedAmount[], words: RentMultipleWords): Pair[] => {
  const between = [...words.links, ...words.rents];
  return months.flatMap((count) =>
    amounts
      .filter((amount) => (amount.offset >= count.end || amount.end <= count.start) && isPlainGap(gapBetween(text, count, amount), between))
      .map((amount) => ({ months: count, amount })),
  );
};

type Statement = { readonly label: number; readonly pair: Pair };

/** Where the statement of one label ends: at the next label of its kind, the end of the sentence, or the end of the line. */
const statementEnd = (text: string, from: number, nextLabel: number | undefined): number => {
  const line = lineBounds(text, from);
  const sentence = SENTENCE_END.exec(text.slice(from, line.end));
  return Math.min(line.end, nextLabel ?? line.end, sentence === null ? line.end : from + sentence.index);
};

/** One label's months count and amount, when the statement holds exactly one such pair and no word that makes it another. */
const statementAt = (
  text: string,
  label: { readonly start: number; readonly end: number },
  next: number | undefined,
  amounts: readonly StatedAmount[],
  words: RentMultipleWords,
): Statement[] => {
  const end = statementEnd(text, label.end, next);
  const piece = text.slice(label.end, end);
  if (occurrences(piece, words.skips).length > 0) return [];
  const months = monthsIn(piece, label.end, words);
  if (months.some((count) => endsRange(text, count, words))) return [];
  const pairs = pairsIn(text, months, amountsBetween(amounts, label.end, end), words);
  const [pair] = pairs;
  const single = pairs.every((other) => other.months.count === pair?.months.count && other.amount.value === pair.amount.value);
  return pair === undefined || !single ? [] : [{ label: label.start, pair }];
};

/** Every label of a multiple with one months count and one amount (敷金 | 2か月（98,000円）). */
const multipleStatements = (text: string, amounts: readonly StatedAmount[], words: RentMultipleWords): Statement[] => {
  const labels = occurrences(text, words.multiples);
  return labels.flatMap((label, index) => statementAt(text, label, labels[index + 1]?.start, amounts, words));
};

/** The fees of the listing a rent belongs to: those after it and before the next rent; for the first rent, else those before it. */
export const feesFor = <T extends Stated>(rent: Stated, rents: readonly Stated[], fees: readonly T[]): T[] => {
  const index = rents.indexOf(rent);
  const next = rents[index + 1]?.offset ?? Number.POSITIVE_INFINITY;
  const ofCurrency = fees.filter((fee) => fee.currency === rent.currency);
  const after = ofCurrency.filter((fee) => fee.offset > rent.offset && fee.offset < next);
  return after.length > 0 || index > 0 ? after : ofCurrency.filter((fee) => fee.offset < rent.offset);
};

const plus = (left: Interval, right: Interval): Interval => ({ low: left.low + right.low, high: left.high + right.high });

/** The monthly amounts a multiple may be of: the rent alone, the rent with each fee, and the rent with every fee. */
export const monthlyBases = (rent: Interval, fees: readonly Interval[]): Interval[] => {
  const withEach = fees.map((fee) => plus(rent, fee));
  const withAll = fees.length > 1 ? [fees.reduce(plus, rent)] : [];
  return [rent, ...withEach, ...withAll];
};

const mismatchOf = (text: string, statement: Statement, rents: readonly Stated[], fees: readonly Stated[]): StructureIssue[] => {
  const rent = nearestStated(rents, statement.label);
  const { months, amount } = statement.pair;
  if (rent?.range === undefined || rent.currency !== amount.currency) return [];
  const feeRanges = feesFor(rent, rents, fees).map((fee) => fee.range);
  if (!feeRanges.every((range) => range !== undefined)) return [];
  const bases = monthlyBases(rent.range, feeRanges);
  if (isMultiple(months.count, intervalOf(amount, text.slice(amount.offset, amount.end)), bases)) return [];
  const values = { months: text.slice(months.start, months.end), amount: text.slice(amount.offset, amount.end), rent: rent.written };
  return [{ offset: Math.min(months.start, amount.offset), values }];
};

/** Every multiple of rent whose amount is not that many months of the listing's rent (or of the rent and its fee). */
export const rentMultipleMismatches = (text: string, amounts: readonly StatedAmount[], words: RentMultipleWords): StructureIssue[] => {
  const rents = statedAmounts(text, words.rents, amounts, words);
  if (rents.length === 0) return [];
  const fees = statedAmounts(text, words.fees, amounts, words);
  return multipleStatements(text, amounts, words).flatMap((statement) => mismatchOf(text, statement, rents, fees));
};
