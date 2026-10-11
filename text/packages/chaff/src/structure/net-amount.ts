/**
 * net-amount-mismatch: the deciding half. A net amount (差引支給額, Net pay) against the gross amount (総支給額, Gross pay)
 * minus the total of deductions (控除合計, Total deductions) written in the same table or the same section. Which words name
 * the three is data (lexicon net-amount-label, grouped gross / deduction / net); nothing here knows a word of payroll. Pure.
 */
import { keyOf, labelKey, noteOf, readNumber } from "./ratio.ts";

export const NET_ROLES = ["gross", "deduction", "net"] as const;
export type NetRole = (typeof NET_ROLES)[number];

export type NetWords = {
  readonly labels: Readonly<Record<NetRole, readonly string[]>>;
  /** Words of magnitude (千, million): an amount written in them is rounded. */
  readonly magnitudes: readonly string[];
  readonly percentUnits: readonly string[];
};

/** An amount as written in a cell or after a label: the text around its number is its unit. */
export type NetAmount = {
  readonly start: number;
  readonly value: number;
  readonly decimals: number;
  readonly prefix: string;
  readonly suffix: string;
  /** What the amount is compared on: the marks around the number and the note of its label (Net pay (USD)). */
  readonly unit: string;
  /** The amount as written, and whether its number groups thousands with commas. */
  readonly written: string;
  readonly grouped: boolean;
};

export type LabelledAmount = NetAmount & { readonly role: NetRole };

export type NetIssue = { readonly offset: number; readonly values: Readonly<Record<string, string>> };

const DECIMAL_BASE = 10;
const HALF = 0.5;

/** The role a label names: the label alone, its note in brackets aside; undefined when it is not one of the words. */
export const roleOf = (label: string, words: NetWords): NetRole | undefined =>
  NET_ROLES.find((role) => words.labels[role].some((pattern) => keyOf(pattern) === labelKey(label)));

/** One plain number with its marks ("256,287円", "$4,301.01"); a percentage, a signed or a bracketed value is not an amount. */
export const amountOf = (text: string, start: number, labelNote: string, words: NetWords): NetAmount | undefined => {
  const cell = readNumber(text);
  if (cell === undefined || words.percentUnits.some((unit) => keyOf(unit) === keyOf(cell.suffix))) return undefined;
  const [prefix, suffix] = [keyOf(cell.prefix), keyOf(cell.suffix)];
  const unit = `${prefix}|${suffix}|${keyOf(labelNote)}`;
  return { start, value: cell.value, decimals: cell.decimals, prefix, suffix, unit, written: text.trim(), grouped: text.normalize("NFKC").includes(",") };
};

/** The one value of a role: all its amounts the same value in the same unit; undefined when there is none or they differ. */
const onlyAmount = (amounts: readonly LabelledAmount[], role: NetRole): LabelledAmount | undefined => {
  const mine = amounts.filter((amount) => amount.role === role);
  const [first] = mine;
  if (first === undefined) return undefined;
  return mine.every((amount) => amount.value === first.value && amount.unit === first.unit) ? (mine.at(-1) ?? first) : undefined;
};

/** A mark of currency and no word of magnitude: the amount is exact. Anything else may be rounded to its last digit. */
const isExact = (amount: NetAmount, words: NetWords): boolean =>
  amount.prefix + amount.suffix !== "" && !words.magnitudes.some((word) => `${amount.prefix} ${amount.suffix}`.includes(keyOf(word)));

/**
 * How far the written net may be from gross minus deductions. Exact amounts must agree to their last digit. Rounded ones
 * (千円, $ million, a bare number whose unit is in a heading) may be off by one step of the coarsest last digit: each of
 * the three is rounded on its own, and a difference of one step is what rounding down or to nearest can leave.
 */
export const allowedGap = (amounts: readonly NetAmount[], words: NetWords): number => {
  const finest = Math.max(...amounts.map((amount) => amount.decimals));
  const coarsest = Math.min(...amounts.map((amount) => amount.decimals));
  return amounts.every((amount) => isExact(amount, words)) ? HALF * DECIMAL_BASE ** -finest : DECIMAL_BASE ** -coarsest + HALF * DECIMAL_BASE ** -finest;
};

const DIGIT = /\p{Nd}/u;
const FULL_WIDTH_DIGIT = /[０-９]/u;
/** The distance from an ASCII digit, comma or point to its full-width form (0 → ０, , → ，). */
const FULL_WIDTH_OFFSET = 0xfee0;

const toFullWidth = (number: string): string => [...number].map((char) => String.fromCodePoint((char.codePointAt(0) ?? 0) + FULL_WIDTH_OFFSET)).join("");

/** The expected net, written the way the net is: the marks around its number, its digits, its decimals, its grouping. */
const shown = (value: number, like: NetAmount, decimals: number): string => {
  const ascii = value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: like.grouped });
  const number = FULL_WIDTH_DIGIT.test(like.written) ? toFullWidth(ascii) : ascii;
  const digits = [...like.written].flatMap((char, index) => (DIGIT.test(char) ? [index] : []));
  const [first = 0, last = like.written.length - 1] = [digits[0], digits.at(-1)];
  return `${like.written.slice(0, first)}${number}${like.written.slice(last + 1)}`;
};

/**
 * One scope (a table column, a table row, a section's labelled lines): gross, deductions and net each found, each with one
 * value, all in one unit. The net is reported when it is not gross minus deductions beyond rounding.
 */
export const netMismatch = (amounts: readonly LabelledAmount[], words: NetWords): NetIssue | undefined => {
  const [gross, deduction, net] = NET_ROLES.map((role) => onlyAmount(amounts, role));
  if (gross === undefined || deduction === undefined || net === undefined) return undefined;
  if (gross.unit !== deduction.unit || gross.unit !== net.unit) return undefined;
  const expected = gross.value - deduction.value;
  if (!Number.isSafeInteger(Math.round(gross.value * DECIMAL_BASE ** gross.decimals))) return undefined;
  if (expected < 0 || Math.abs(expected - net.value) <= allowedGap([gross, deduction, net], words)) return undefined;
  const decimals = Math.max(gross.decimals, deduction.decimals, net.decimals);
  return { offset: net.start, values: { written: net.written, expected: shown(expected, net, decimals) } };
};

/** A table line read as its cells, each without its edge marks, by where it starts. */
export type NetCell = { readonly start: number; readonly text: string };

const labelledCells = (labels: readonly NetCell[], values: readonly NetCell[], words: NetWords): LabelledAmount[] =>
  labels.flatMap((label, column) => {
    const role = roleOf(label.text, words);
    const value = values[column];
    const amount = role === undefined || value === undefined ? undefined : amountOf(value.text, value.start, noteOf(label.text), words);
    return role === undefined || amount === undefined ? [] : [{ ...amount, role }];
  });

/** A table whose header names the three columns: each body row of the same width is one scope. */
const byColumns = (header: readonly NetCell[], rows: readonly (readonly NetCell[])[], words: NetWords): NetIssue[] =>
  rows.flatMap((row) => {
    if (row.length !== header.length) return [];
    const issue = netMismatch(labelledCells(header, row, words), words);
    return issue === undefined ? [] : [issue];
  });

/** A table whose rows are labelled in their first cell: each column after the labels is one scope. */
const byRows = (rows: readonly (readonly NetCell[])[], words: NetWords): NetIssue[] => {
  const labelled = rows.filter((row) => row[0] !== undefined && roleOf(row[0].text, words) !== undefined);
  const width = labelled[0]?.length ?? 0;
  if (labelled.length === 0 || labelled.some((row) => row.length !== width)) return [];
  return Array.from({ length: width - 1 }, (_, index) => index + 1).flatMap((column) => {
    const amounts = labelled.flatMap((row) => labelledCells([row[0] ?? { start: 0, text: "" }], [row[column] ?? { start: 0, text: "" }], words));
    const issue = netMismatch(amounts, words);
    return issue === undefined ? [] : [issue];
  });
};

/** One table, read both ways: its header naming the columns, and its first column naming the rows. */
export const tableNetMismatches = (header: readonly NetCell[], rows: readonly (readonly NetCell[])[], words: NetWords): NetIssue[] => {
  const issues = [...byColumns(header, rows, words), ...byRows(rows, words)];
  return issues.filter((issue, index) => issues.findIndex((other) => other.offset === issue.offset) === index);
};

/** A line that is a label and its amount (総支給額：117,380円, - Net pay: $1,396.41). */
export type LabelledLine = { readonly label: string; readonly value: NetCell };

/** The labelled lines of one section: each label that names a role, with its amount. */
export const sectionNetMismatch = (lines: readonly LabelledLine[], words: NetWords): NetIssue | undefined =>
  netMismatch(
    lines.flatMap((line) => labelledCells([{ start: 0, text: line.label }], [line.value], words)),
    words,
  );
