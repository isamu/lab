// interest-mismatch: an interest calculation written on one line (「お利息の計算：対象残高400,000円 × 利率0.10% ＝ 400円」,
// "Interest for the month: average balance $3,600.00 × rate 0.05% = $1.80") whose amount is not the balance times the
// rate. The rate is read as written: one marked for a period (年利, APR) is used only when the line names the same period
// for the interest, and is never converted by a day count. A line marked after tax is not read. Pure.
import type { Line } from "./lines.ts";
import type { StructureIssue } from "./issues.ts";
import { plain, valueIn } from "./change-rate-table.ts";
import { shownLike, type Money } from "./share-amount.ts";
import { roundedMatches } from "./tax.ts";
import { escapeRegExp } from "../orthography.ts";

/** interest: the interest itself. base: the balance it is on. rate: the rate. net: interest after tax, not compared. */
export type InterestRole = "interest" | "base" | "rate" | "net";
export type InterestPeriod = "year" | "month";
export type InterestWord = { readonly pattern: string; readonly role: InterestRole };
/** A word that says what period a rate is for (年利, APR), or what period the interest is for (年間, for the month). */
export type PeriodWord = { readonly pattern: string; readonly period: InterestPeriod; readonly of: "rate" | "interest" };
export type InterestWords = { readonly labels: readonly InterestWord[]; readonly periods: readonly PeriodWord[] };

const TIMES = /[×✕]/gu;
const EQUALS = /[=＝]/gu;
const PERCENT = /(?<![\d.])(\d+(?:\.\d+)?)[ \t]?%/gu;
const TRAILING_STOP = /[.。]\s*$/u;
const NUMBER = /\d[\d,]*(?:\.(\d+))?/u;
const FIRST_FIGURE = /[\d$€£¥￥]/u;
/** A bracketed note as written, in either width: blanked to spaces so the figure after it keeps its place. */
const WRITTEN_BRACKETED = /[(（][^()（）]*[)）]/gu;
const LATIN = /[a-z]/u;
const MAX_RATE = 100;
const CENTS = 100;

type Rate = { readonly value: number; readonly written: string };
type Calculation = { readonly before: string; readonly rate: string; readonly amount: string; readonly amountAt: number };

const keyOf = (text: string): string => plain(text).toLowerCase();

/** Where each whole occurrence of a word ends in a key: a Latin word stands as a whole word, anything else as written. */
const endsOf = (key: string, pattern: string): number[] => {
  const word = keyOf(pattern);
  if (word === "") return [];
  const source = LATIN.test(word) ? `(?<![a-z0-9])${escapeRegExp(word)}(?![a-z0-9])` : escapeRegExp(word);
  return [...key.matchAll(new RegExp(source, "gu"))].map((match) => match.index + word.length);
};

const patternsOf = (words: InterestWords, role: InterestRole): string[] => words.labels.flatMap((word) => (word.role === role ? [word.pattern] : []));

const holdsAny = (key: string, patterns: readonly string[]): boolean => patterns.some((pattern) => endsOf(key, pattern).length > 0);

/** Where the last of the words ends in the key, -1 when none is there. */
const lastEnd = (key: string, patterns: readonly string[]): number => Math.max(-1, ...patterns.flatMap((pattern) => endsOf(key, pattern)));

// The text that may name the interest and its period: before × and after =, not the rate between.
const interestKeyOf = (calculation: Calculation): string => `${keyOf(calculation.before)} ${keyOf(calculation.amount)}`;

/** The line cut at its one × and its one =: what is before ×, between them (empty when = comes first), and after =. */
const calculationOf = (text: string): Calculation | undefined => {
  const times = [...text.matchAll(TIMES)];
  const equals = [...text.matchAll(EQUALS)];
  const [timesMatch, equalsMatch] = [times[0], equals[0]];
  if (times.length !== 1 || equals.length !== 1 || timesMatch === undefined || equalsMatch === undefined) return undefined;
  const amount = text.slice(equalsMatch.index + 1);
  const figure = amount.replace(WRITTEN_BRACKETED, (note) => " ".repeat(note.length)).search(FIRST_FIGURE);
  return {
    before: text.slice(0, timesMatch.index),
    rate: text.slice(timesMatch.index + 1, equalsMatch.index),
    amount,
    amountAt: equalsMatch.index + 1 + Math.max(figure, 0),
  };
};

/** The one percentage written between × and =, with a rate word: 利率0.10%, rate 0.05%. */
const rateIn = (segment: string, words: InterestWords): Rate | undefined => {
  const key = keyOf(segment);
  const rates = [...key.matchAll(PERCENT)];
  const [only] = rates;
  if (rates.length !== 1 || only === undefined || !holdsAny(key, patternsOf(words, "rate"))) return undefined;
  const value = Number(only[1]);
  return value > 0 && value < MAX_RATE ? { value, written: only[0] } : undefined;
};

const moneyIn = (text: string): Money | undefined => {
  const value = valueIn(text);
  if (value === undefined) return undefined;
  const decimals = NUMBER.exec(text)?.[1]?.length ?? 0;
  return { value: value.value, decimals, marks: value.marks, offset: 0, text: plain(text) };
};

/** The balance: what follows the last balance word before ×: 「対象残高1,200,000円」, "average balance $12,400.00". */
const baseIn = (segment: string, words: InterestWords): Money | undefined => {
  const text = plain(segment);
  const end = lastEnd(text.toLowerCase(), patternsOf(words, "base"));
  return end < 0 ? undefined : moneyIn(text.slice(end));
};

/** The amount after =, less a bracketed note, a closing stop and an interest word before it (＝ お利息400円). */
const amountIn = (segment: string, words: InterestWords): Money | undefined => {
  const text = plain(segment).replace(WRITTEN_BRACKETED, "").replace(TRAILING_STOP, "");
  return moneyIn(text.slice(Math.max(0, lastEnd(text.toLowerCase(), patternsOf(words, "interest")))));
};

/** The one period the words of this kind name in the key; undefined when none or two. */
const periodIn = (key: string, words: InterestWords, of: PeriodWord["of"]): InterestPeriod | undefined => {
  const periods = new Set(words.periods.filter((word) => word.of === of && endsOf(key, word.pattern).length > 0).map((word) => word.period));
  return periods.size === 1 ? [...periods][0] : undefined;
};

/** A rate marked for a period (年利, APR) is the interest's only when the line names that period for the interest. */
const ratePeriodFits = (calculation: Calculation, words: InterestWords): boolean => {
  const rateKey = keyOf(calculation.rate);
  const ratePeriods = words.periods.filter((word) => word.of === "rate" && endsOf(rateKey, word.pattern).length > 0);
  if (ratePeriods.length === 0) return true;
  const ratePeriod = periodIn(rateKey, words, "rate");
  return ratePeriod !== undefined && ratePeriod === periodIn(interestKeyOf(calculation), words, "interest");
};

/** The line is an interest calculation: an interest word before × or after =, and no word of interest after tax. */
const isGrossInterest = (line: Line, calculation: Calculation, words: InterestWords): boolean => {
  return holdsAny(interestKeyOf(calculation), patternsOf(words, "interest")) && !holdsAny(keyOf(line.text), patternsOf(words, "net"));
};

const lineIssues = (line: Line, words: InterestWords): StructureIssue[] => {
  const calculation = calculationOf(line.text);
  if (calculation === undefined || !isGrossInterest(line, calculation, words) || !ratePeriodFits(calculation, words)) return [];
  const [base, rate, amount] = [baseIn(calculation.before, words), rateIn(calculation.rate, words), amountIn(calculation.amount, words)];
  if (base === undefined || rate === undefined || amount === undefined || base.marks !== amount.marks) return [];
  if (roundedMatches(Math.round(amount.value * CENTS), base.value * rate.value, amount.decimals === 0)) return [];
  const expected = shownLike(amount, (base.value * rate.value) / MAX_RATE, undefined);
  return [{ offset: line.start + calculation.amountAt, values: { written: amount.text, expected, rate: rate.written, base: base.text } }];
};

/** Each interest calculation line whose amount is not the balance times the rate, rounded down, to nearest or up. */
export const interestMismatches = (lines: readonly Line[], words: InterestWords): StructureIssue[] =>
  words.labels.length === 0 ? [] : lines.flatMap((line) => lineIssues(line, words));
