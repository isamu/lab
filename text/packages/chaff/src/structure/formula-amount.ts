import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { alternation, intervalOf, type Interval, type StatedAmount } from "./stated-multiple.ts";
import { statedTaxRates, type TaxPriceWord } from "./tax-price.ts";
import { roundedMatches } from "./tax.ts";
import { escapeRegExp } from "../orthography.ts";

/**
 * formula-amount-mismatch: a row whose label writes the formula of its amount (仲介手数料（売買代金の3%＋60,000円、消費税込み）
 * | 1,650,000円, "Commission (5% of the sale price) | $16,200.00") is worked out from the amount the document labels with that
 * name (売買代金 | 48,000,000円) and compared with the row's amount. A label that says the tax is included adds the rate
 * the label states, else the one rate the document states beside a tax word, else the profile's rate. The words come from the
 * lexicons. Pure.
 */

export type FormulaWords = {
  /** Words between a name and its rate (売買代金の3%). */
  readonly nameRate: readonly string[];
  /** Words between a rate and its name (3% of the sale price). */
  readonly rateName: readonly string[];
  /** Words before a fixed amount added to the rate's part (＋60,000円, plus $500). */
  readonly plus: readonly string[];
  /** The marks of a percent (%, ％, percent). */
  readonly percent: readonly string[];
  /** The words of a price with tax and of a tax rate (税込み, 消費税), as tax-mismatch reads them. */
  readonly tax: readonly TaxPriceWord[];
  /** The names of a tax (消費税, VAT) and the words that say it is included (込み, included): 消費税8%込み, VAT included. */
  readonly taxNames: readonly string[];
  readonly includedWords: readonly string[];
  /** Words that say a tax is left out although a word of inclusion stands in them (not included, 含まない). */
  readonly notIncluded: readonly string[];
};

export type FormulaText = {
  readonly text: string;
  readonly amounts: readonly StatedAmount[];
  /** The tax rate a label's tax-included word means when neither the label nor the document states one (the profile's). */
  readonly defaultTaxRate: number | undefined;
};

/** The rate and the name it is of, with where they stand in the label. */
type Formula = { readonly start: number; readonly end: number; readonly rate: number; readonly name: string };
type Named = Omit<Formula, "rate">;

/** A line ending in one amount after a separator, and the label before that separator. */
type Row = { readonly line: Line; readonly label: string; readonly amount: StatedAmount };

/** What the row's amount is worked out from. */
type Terms = { readonly formula: Formula; readonly base: StatedAmount; readonly fixed: StatedAmount | undefined; readonly tax: number };

const CENTS = 100;
const HUNDRED = 100;
const NAME_MAX = 40;
const AFTER_AMOUNT = /^[\s|｜]*$/u;
const SEPARATOR = /[|｜:：]\s*$/u;
const NAME_EDGE = "()（）、,，;；|｜:：「」『』";
const LAST_EDGE = new RegExp(`[${escapeRegExp(NAME_EDGE)}][^${escapeRegExp(NAME_EDGE)}]*$`, "u");
const LIST_MARK = /^(?:[-*+・]|\d+[.)])\s+/u;
const DIGITS = /[0-9０-９]/u;
const NUMBER = /\d[\d,]*(?:\.\d+)?/u;
/** Four digits or more with no comma: the row groups none, so the expected amount is not grouped either. */
const UNGROUPED = /\d{4}/u;

const numberOf = (written: string): number => Number(written.normalize("NFKC"));

const percentPattern = (words: FormulaWords): RegExp | undefined => {
  const marks = alternation(words.percent);
  return marks === undefined ? undefined : new RegExp(`(?<![0-9０-９.,．，])([0-9０-９]+(?:[.．][0-9０-９]+)?)\\s?(?:${marks})`, "giu");
};

const amountsWithin = (amounts: readonly StatedAmount[], start: number, end: number): StatedAmount[] =>
  amounts.filter((amount) => amount.offset >= start && amount.end <= end);

/** The line's last amount, with only a separator before it and nothing after it, and the text before that separator. */
const rowOf = (text: string, line: Line, amounts: readonly StatedAmount[]): Row | undefined => {
  const end = line.start + line.text.length;
  const amount = amountsWithin(amounts, line.start, end).at(-1);
  if (amount === undefined || amount.scale !== undefined || !AFTER_AMOUNT.test(text.slice(amount.end, end))) return undefined;
  const before = text.slice(line.start, amount.offset);
  const separator = SEPARATOR.exec(before);
  return separator === null ? undefined : { line, label: before.slice(0, separator.index), amount };
};

const isName = (name: string): boolean => name !== "" && name.length <= NAME_MAX && !DIGITS.test(name);

/** 売買代金の3%: the name runs back from the word to the nearest bracket, comma or cell edge. */
const nameBefore = (label: string, rateStart: number, words: FormulaWords): Named | undefined => {
  const head = label.slice(0, rateStart).trimEnd();
  const word = words.nameRate.find((each) => head.toLowerCase().endsWith(each.toLowerCase()));
  if (word === undefined) return undefined;
  const upTo = head.slice(0, head.length - word.length);
  const edge = LAST_EDGE.exec(upTo);
  const from = edge === null ? 0 : edge.index + 1;
  const raw = upTo.slice(from).replace(LIST_MARK, "");
  const name = raw.trim();
  return isName(name) ? { start: upTo.length - raw.trimStart().length, end: rateStart, name } : undefined;
};

/** 3% of the sale price: the name runs on from the word to a bracket, a comma, a plus word or a tax phrase (incl. tax). */
const nameAfter = (label: string, rateEnd: number, words: FormulaWords): Named | undefined => {
  const joiner = alternation(words.rateName);
  const word = joiner === undefined ? null : new RegExp(`^\\s*(?:${joiner})\\s+`, "iu").exec(label.slice(rateEnd));
  if (word === null) return undefined;
  const from = rateEnd + word[0].length;
  const taxPhrases = words.tax.filter((each) => each.role !== "rate").map((each) => each.pattern);
  const stops = [`[${escapeRegExp(NAME_EDGE)}]`, alternation([...words.plus, ...taxPhrases]) ?? "(?!)"];
  const stop = new RegExp(stops.join("|"), "iu").exec(label.slice(from));
  const name = label.slice(from, stop === null ? label.length : from + stop.index).trim();
  return isName(name) ? { start: from, end: from + name.length, name } : undefined;
};

/** The one rate in the label that names what it is of; two such rates are not read. */
const formulaIn = (label: string, words: FormulaWords): Formula | undefined => {
  const pattern = percentPattern(words);
  if (pattern === undefined) return undefined;
  const found = [...label.matchAll(pattern)].flatMap((match) => {
    const rateEnd = match.index + match[0].length;
    const named = nameBefore(label, match.index, words) ?? nameAfter(label, rateEnd, words);
    if (named === undefined) return [];
    return [{ start: Math.min(named.start, match.index), end: Math.max(named.end, rateEnd), rate: numberOf(match[1] ?? ""), name: named.name }];
  });
  const others = [...label.matchAll(pattern)].length - found.length;
  return found.length === 1 && others <= statedTaxRates([label], words.tax).length ? found[0] : undefined;
};

/**
 * The amount right after a plus word after the formula (＋60,000円), or none. Undefined when the label holds any other
 * amount, or a plus word with no amount after it: the formula is then not all written in the label.
 */
const fixedOf = (text: string, row: Row, formula: Formula, amounts: readonly StatedAmount[], words: FormulaWords): StatedAmount[] | undefined => {
  const inLabel = amountsWithin(amounts, row.line.start, row.line.start + row.label.length);
  const plus = alternation(words.plus);
  const after = row.line.start + formula.end;
  const gap = plus === undefined ? null : new RegExp(`^\\s*(?:${plus})\\s*`, "iu").exec(text.slice(after, row.line.start + row.label.length));
  const fixed = gap === null ? undefined : inLabel.find((amount) => amount.offset === after + gap[0].length);
  if (gap !== null && fixed === undefined) return undefined;
  const parts = fixed === undefined ? [] : [fixed];
  return inLabel.length === parts.length ? parts : undefined;
};

/**
 * A word of a price with tax (税込み, incl. tax), or a tax's name with a word of inclusion (消費税8%込み, VAT included); not
 * when the label also says the tax is left out (税別, excl. tax, tax not included).
 */
const isTaxIncluded = (label: string, words: FormulaWords): boolean => {
  const lower = label.normalize("NFKC").toLowerCase();
  const holds = (word: string): boolean => lower.includes(word.normalize("NFKC").toLowerCase());
  const roleHeld = (role: TaxPriceWord["role"]): boolean => words.tax.some((word) => word.role === role && holds(word.pattern));
  if (roleHeld("excluded") || words.notIncluded.some(holds)) return false;
  return roleHeld("included") || (words.taxNames.some(holds) && words.includedWords.some(holds));
};

/** 0 without a tax-included word; else the label's one rate, the document's one rate, or the profile's. Undefined when unknown. */
const taxRateOf = (row: Row, others: readonly string[], text: FormulaText, words: FormulaWords): number | undefined => {
  if (!isTaxIncluded(row.label, words)) return 0;
  const inLabel = statedTaxRates([row.label], words.tax);
  if (inLabel.length > 0) return inLabel.length === 1 ? inLabel[0] : undefined;
  const stated = statedTaxRates(others, words.tax);
  if (stated.length > 0) return stated.length === 1 ? stated[0] : undefined;
  return text.defaultTaxRate;
};

/** The amount the document labels with the name (売買代金 | 48,000,000円, Sale price: $324,000), when every such label agrees. */
const baseOf = (text: string, lines: readonly Line[], row: Row, name: string, amounts: readonly StatedAmount[]): StatedAmount | undefined => {
  const label = new RegExp(`^[ \\t]*(?:[-*+][ \\t]+)?(?:[|｜][ \\t]*)?(?:\\*\\*)?${escapeRegExp(name)}(?:\\*\\*)?[ \\t]*[|｜:：][ \\t]*`, "iu");
  const found = lines.flatMap((line) => {
    const match = line === row.line ? null : label.exec(line.text);
    const amount = match === null ? undefined : amounts.find((each) => each.offset === line.start + match[0].length);
    return amount === undefined || amount.currency !== row.amount.currency ? [] : [amount];
  });
  const [first] = found;
  return found.every((amount) => amount.value === first?.value && amount.scale === first.scale) ? first : undefined;
};

/** Before tax: rate × base + fixed. The base is the interval its written digits allow; a formula's fixed part is exact (＋6万円 is 60,000). */
const beforeTax = (text: string, terms: Terms): Interval => {
  const base = intervalOf(terms.base, text.slice(terms.base.offset, terms.base.end));
  const fixed = terms.fixed?.value ?? 0;
  return { low: (base.low * terms.formula.rate) / HUNDRED + fixed, high: (base.high * terms.formula.rate) / HUNDRED + fixed };
};

const ROUNDINGS: readonly ((value: number) => number)[] = [(value) => value, Math.floor, Math.round, Math.ceil];

/** Whether the written amount is the formula's, rounded down, to nearest or up, before tax or after it, to the unit or the cent. */
export const formulaMatches = (written: number, before: Interval, tax: number): boolean => {
  const withTax = (value: number): number => (value * (HUNDRED + tax)) / HUNDRED;
  // A base written with a word of scale (4,800万円) is a range; any amount in it, rounded to the unit, is right.
  if (before.low < before.high && written >= Math.floor(withTax(before.low)) && written <= Math.ceil(withTax(before.high))) return true;
  const candidates = [before.low, before.high].flatMap((value) => ROUNDINGS.map((round) => withTax(round(value))));
  return candidates.some((candidate) => roundedMatches(Math.round(written * CENTS), candidate * CENTS));
};

/** The expected amount as the row writes it: its unit, its grouping and its decimals. */
const shownLike = (written: string, value: number): string => {
  const decimals = NUMBER.exec(written.normalize("NFKC"))?.[0].split(".")[1]?.length ?? 0;
  const grouped = written.includes(",") || !UNGROUPED.test(written.normalize("NFKC"));
  const number = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped });
  return written.normalize("NFKC").replace(NUMBER, number);
};

const issueOf = (text: string, row: Row, terms: Terms): StructureIssue[] => {
  const before = beforeTax(text, terms);
  if (formulaMatches(row.amount.value, before, terms.tax)) return [];
  const expected = (((before.low + before.high) / 2) * (HUNDRED + terms.tax)) / HUNDRED;
  const values = {
    written: text.slice(row.amount.offset, row.amount.end),
    expected: shownLike(text.slice(row.amount.offset, row.amount.end), Math.round(expected)),
    formula: text.slice(row.line.start + terms.formula.start, terms.fixed?.end ?? row.line.start + terms.formula.end),
    name: terms.formula.name,
    base: text.slice(terms.base.offset, terms.base.end),
  };
  return [{ offset: row.amount.offset, values }];
};

const termsOf = (input: FormulaText, lines: readonly Line[], row: Row, words: FormulaWords): Terms | undefined => {
  const formula = formulaIn(row.label, words);
  if (formula === undefined) return undefined;
  const fixedList = fixedOf(input.text, row, formula, input.amounts, words);
  const [fixed] = fixedList ?? [];
  if (fixedList === undefined || (fixed !== undefined && fixed.currency !== row.amount.currency)) return undefined;
  const base = baseOf(input.text, lines, row, formula.name, input.amounts);
  const others = lines.filter((line) => line !== row.line).map((line) => line.text);
  const tax = taxRateOf(row, others, input, words);
  return base === undefined || tax === undefined ? undefined : { formula, base, fixed, tax };
};

/** Every row whose label writes its formula and whose amount is not what the formula gives on the named amount. */
export const formulaAmountMismatches = (input: FormulaText, words: FormulaWords): StructureIssue[] => {
  if (words.percent.length === 0 || words.nameRate.length + words.rateName.length === 0) return [];
  const lines = linesOf(input.text);
  return lines.flatMap((line) => {
    const row = rowOf(input.text, line, input.amounts);
    const terms = row === undefined ? undefined : termsOf(input, lines, row, words);
    return row === undefined || terms === undefined ? [] : issueOf(input.text, row, terms);
  });
};
