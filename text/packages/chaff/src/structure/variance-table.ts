// variance-mismatch: a budget-versus-actual table whose variance cell is not the actual less the budget, or the budget less
// the actual, whichever the table's other rows follow. Which heading names which column is data (lexicon variance-column);
// the cells are read with change-rate-table's readers. Pure.
import type { StructureIssue } from "./issues.ts";
import { holds, plain, valueIn, type ChangeTable, type TableCell } from "./change-rate-table.ts";
import { bodyRows, offsetOf } from "./order-quantity.ts";

export type VarianceRole = "rate" | "variance" | "budget" | "actual";
export type VarianceWord = { readonly pattern: string; readonly role: VarianceRole };
export type VarianceWords = {
  readonly columns: readonly VarianceWord[];
  /** Words of magnitude (千, million): an amount written in them is rounded. */
  readonly multipliers: readonly string[];
};

/** Rate words first (増減率 holds 増減, 予算比率 holds 予算), then the variance (予算比 holds 予算). */
const ROLE_ORDER: readonly VarianceRole[] = ["rate", "variance", "budget", "actual"];
const NEGATIVE_MARKS: ReadonlySet<string> = new Set(["-", "−", "▲", "△"]);
/** A negative written in brackets: ($20.00), $(20.00), (6,000)円. */
const BRACKETED = /^([^()\d]*)\(([^()]*)\)([^()\d]*)$/u;
/** The mark of a negative or positive: △6,000円, ▲6,000, -$20.00, $-20.00, +4,680円. */
const SIGN = /[△▲\-−+]/u;
const SIGN_OR_BRACKET = /[△▲\-−+()]/u;
const DIGIT_OR_MARK = /[\d△▲\-−+()]/u;
const HALF = 0.5;

type Columns = { readonly budget: number; readonly actual: number; readonly variance: number };
type Amount = { readonly value: number; readonly step: number; readonly marks: string };
type Variance = Amount & { readonly written: string };

/** The heading's role; none when it names both the budget and the actual and no variance or rate (Budget / Actual). */
const roleOf = (heading: string, words: readonly VarianceWord[]): VarianceRole | undefined => {
  const key = plain(heading).toLowerCase();
  const named = ROLE_ORDER.filter((role) => words.some((word) => word.role === role && holds(key, word.pattern)));
  const [first] = named;
  return first === "budget" && named.includes("actual") ? undefined : first;
};

/** The one budget, actual and variance column the headings name; undefined when any is missing or named twice. */
export const varianceColumnsOf = (headings: readonly string[], words: readonly VarianceWord[]): Columns | undefined => {
  const roles = headings.map((heading) => roleOf(heading, words));
  const only = (role: VarianceRole): number | undefined => {
    const indexes = roles.flatMap((found, index) => (found === role ? [index] : []));
    return indexes.length === 1 ? indexes[0] : undefined;
  };
  const [budget, actual, variance] = [only("budget"), only("actual"), only("variance")];
  return budget === undefined || actual === undefined || variance === undefined ? undefined : { budget, actual, variance };
};

/** The signed amount a variance cell writes: △, ▲, −, - or brackets for a negative; undefined when it is not an amount (—, 1.2%). */
export const signedIn = (text: string): Amount | undefined => {
  const cell = plain(text);
  const bracket = BRACKETED.exec(cell);
  if (bracket !== null) {
    const inner = valueIn(`${bracket[1] ?? ""}${bracket[2] ?? ""}${bracket[3] ?? ""}`);
    return inner === undefined ? undefined : { ...inner, value: -inner.value };
  }
  const at = cell.search(SIGN);
  if (at < 0) return valueIn(cell);
  const [before, mark, after] = [cell.slice(0, at), cell.charAt(at), cell.slice(at + 1)];
  if (DIGIT_OR_MARK.test(before) || SIGN_OR_BRACKET.test(after)) return undefined;
  const inner = valueIn(`${before.trimEnd()}${after.trimStart()}`);
  if (inner === undefined) return undefined;
  return NEGATIVE_MARKS.has(mark) ? { ...inner, value: -inner.value } : inner;
};

/** A mark of currency and no word of magnitude: the amounts are exact. A bare number or 千円, $ million may be rounded. */
const isRounded = (marks: string, multipliers: readonly string[]): boolean =>
  marks === "|" || multipliers.some((word) => marks.toLowerCase().includes(word.toLowerCase()));

type Row = {
  readonly cell: TableCell;
  readonly label: string;
  readonly variance: Variance;
  /** actual − budget */
  readonly difference: number;
  readonly gap: number;
};

/** How far a written variance may be from the difference: rounded amounts by one step of the coarsest last digit. */
const gapOf = (amounts: readonly Amount[], rounded: boolean): number => {
  const steps = amounts.map((amount) => amount.step);
  const [finest, coarsest] = [Math.min(...steps), Math.max(...steps)];
  return rounded ? coarsest + HALF * finest : HALF * finest;
};

const rowOf = (row: readonly TableCell[], columns: Columns, words: VarianceWords): Row | undefined => {
  const [budgetCell, actualCell, cell] = [row[columns.budget], row[columns.actual], row[columns.variance]];
  const budget = budgetCell === undefined ? undefined : valueIn(budgetCell.text);
  const actual = actualCell === undefined ? undefined : valueIn(actualCell.text);
  const variance = cell === undefined ? undefined : signedIn(cell.text);
  if (cell === undefined || budget === undefined || actual === undefined || variance === undefined) return undefined;
  if (budget.marks !== actual.marks || (variance.marks !== budget.marks && variance.marks !== "|")) return undefined;
  const gap = gapOf([budget, actual, variance], isRounded(budget.marks, words.multipliers));
  return { cell, label: plain(row[0]?.text ?? ""), variance: { ...variance, written: plain(cell.text) }, difference: actual.value - budget.value, gap };
};

type Convention = 1 | -1;
const CONVENTIONS: readonly Convention[] = [1, -1];

const opposite = (convention: Convention): Convention => (convention === 1 ? -1 : 1);

const follows = (row: Row, convention: Convention): boolean => Math.abs(row.variance.value - convention * row.difference) <= row.gap;

/** Rows whose variance is the same under both conventions (a zero difference) say nothing about which one the table uses. */
const votesFor = (rows: readonly Row[], convention: Convention): number =>
  rows.filter((row) => follows(row, convention) && !follows(row, opposite(convention))).length;

/**
 * The convention most rows follow (1: actual − budget, -1: budget − actual); undefined on a tie. A row following the
 * other convention is a sign slip only when it is the one such row: two or more are a convention the writer chose.
 */
const conventionOf = (rows: readonly Row[]): { readonly convention: Convention; readonly others: number } | undefined => {
  const [forward, backward] = CONVENTIONS.map((convention) => votesFor(rows, convention));
  if (forward === backward || forward === undefined || backward === undefined) return undefined;
  return forward > backward ? { convention: 1, others: backward } : { convention: -1, others: forward };
};

const NUMBER = /\d[\d,]*(?:\.\d+)?/u;
const SIGN_MARKS = /[△▲\-−+()]/gu;

const sameSign = (value: number, expected: number): boolean => value < 0 === expected < 0;

/** The expected variance written the way a cell of the same sign in the table is (△6,900円, ($10.80)), else like the written one. */
const shown = (expected: number, row: Row, rows: readonly Row[]): string => {
  const like = rows.find((other) => other.variance.marks === row.variance.marks && sameSign(other.variance.value, expected)) ?? row;
  const decimals = Math.max(0, -Math.round(Math.log10(row.variance.step)));
  const number = Math.abs(expected).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: like.variance.written.includes(","),
  });
  const filled = like.variance.written.replace(NUMBER, number);
  if (sameSign(like.variance.value, expected)) return filled;
  const unsigned = filled.replace(SIGN_MARKS, "").trim();
  return expected < 0 ? `-${unsigned}` : unsigned;
};

const tableIssues = (rows: readonly Row[], fallback: Convention | undefined): StructureIssue[] => {
  const silent = votesFor(rows, 1) === 0 && votesFor(rows, -1) === 0;
  const decided = silent && fallback !== undefined ? { convention: fallback, others: 0 } : conventionOf(rows);
  if (decided === undefined) return [];
  const { convention, others } = decided;
  return rows.flatMap((row) => {
    if (follows(row, convention) || (follows(row, opposite(convention)) && others > 1)) return [];
    const expected = convention * row.difference;
    return [{ offset: offsetOf(row.cell), values: { item: row.label, written: row.variance.written, expected: shown(expected, row, rows) } }];
  });
};

/**
 * Each row of a budget / actual / variance table whose variance is neither rounding away from the actual less the budget
 * nor, in a table whose rows take the budget less the actual, from that. The convention is the one most of the table's
 * rows follow; a table where no row tells takes the document's, and one where the rows split evenly is left alone.
 */
export const varianceMismatches = (tables: readonly ChangeTable[], words: VarianceWords): StructureIssue[] => {
  const read = tables.flatMap((table) => {
    const columns = varianceColumnsOf(
      table.header.map((cell) => cell.text),
      words.columns,
    );
    if (columns === undefined) return [];
    return [bodyRows(table).flatMap((row) => rowOf(row, columns, words) ?? [])];
  });
  const fallback = conventionOf(read.flat())?.convention;
  return read.flatMap((rows) => tableIssues(rows, fallback));
};
