// running-balance-mismatch: a table with a running balance column (a repayment schedule, an account ledger, a stock card),
// where each row's balance is the row above's less this row's principal (or payment), or plus what came in less what went out.
// The columns are named by their heading words only. Pure.
import type { StructureIssue } from "./issues.ts";
import { holds, plain, valueIn, type ChangeTable, type TableCell } from "./change-rate-table.ts";

export type BalanceRole = "date" | "sequence" | "balance" | "interest" | "principal" | "in" | "out" | "payment";
export type BalanceWord = { readonly pattern: string; readonly role: BalanceRole };
export type BalanceWords = { readonly columns: readonly BalanceWord[]; readonly totalLabels: readonly string[] };

/** A date column first (「お支払日」, "Payment date" are not payments), then the balance ("Balance after payment", 「残元金」). */
const ROLE_ORDER: readonly BalanceRole[] = ["date", "sequence", "balance", "interest", "principal", "in", "out", "payment"];

/** How a row moves the balance: down by its principal or payment (a loan), or up by what came in and down by what went out. */
export type BalanceColumns =
  | { readonly kind: "loan"; readonly balance: number; readonly movement: number; readonly sequence?: number }
  | { readonly kind: "ledger"; readonly balance: number; readonly in?: number; readonly out?: number; readonly sequence?: number };

/** A heading that names both directions ("Deposit/Withdrawal", 「入出金」) says neither: its sign is in each row, unread. */
const BOTH_WAYS = "both";

const roleOf = (heading: string, words: readonly BalanceWord[]): BalanceRole | typeof BOTH_WAYS | undefined => {
  const key = plain(heading).toLowerCase();
  const named = ROLE_ORDER.filter((role) => words.some((word) => word.role === role && holds(key, word.pattern)));
  if (named.includes("in") && named.includes("out")) return BOTH_WAYS;
  return named[0];
};

/** The one column of a role: undefined when none or several carry it. */
const onlyIndex = (indexes: readonly number[]): number | undefined => (indexes.length === 1 ? indexes[0] : undefined);

const optional = (key: "in" | "out" | "sequence", index: number | undefined): Record<string, number> => (index === undefined ? {} : { [key]: index });

/**
 * The columns a table's headings name. A principal column is the movement; without one, a payment column is, but only when
 * no interest column says part of the payment is not principal. A table with both loan and ledger columns is not read, and
 * neither is one with no date or row-number column: its rows may be different accounts or items, not one balance over time.
 */
export const balanceColumnsOf = (headings: readonly string[], words: readonly BalanceWord[]): BalanceColumns | undefined => {
  const roles = headings.map((heading) => roleOf(heading, words));
  const all = (role: BalanceRole): number[] => roles.flatMap((found, index) => (found === role ? [index] : []));
  const balance = onlyIndex(all("balance"));
  const sequence = optional("sequence", onlyIndex(all("sequence")));
  const overTime = all("date").length > 0 || all("sequence").length === 1;
  if (balance === undefined || all("sequence").length > 1 || !overTime || roles.includes(BOTH_WAYS)) return undefined;
  const loanColumns = all("principal").length + all("payment").length + all("interest").length;
  const ledgerColumns = all("in").length + all("out").length;
  if (ledgerColumns > 0) {
    const [inColumn, outColumn] = [onlyIndex(all("in")), onlyIndex(all("out"))];
    if (loanColumns > 0 || all("in").length > 1 || all("out").length > 1) return undefined;
    return { kind: "ledger", balance, ...optional("in", inColumn), ...optional("out", outColumn), ...sequence };
  }
  const principal = all("principal").length > 0 ? onlyIndex(all("principal")) : undefined;
  const payment = all("principal").length === 0 && all("interest").length === 0 ? onlyIndex(all("payment")) : undefined;
  const movement = principal ?? payment;
  return movement === undefined ? undefined : { kind: "loan", balance, movement, ...sequence };
};

type Amount = { readonly value: number; readonly step: number; readonly marks: string };

/** A cell that says nothing came in or went out: blank, or a dash. */
const NOTHING = /^[-−–—―ー－]?$/u;

const amountIn = (cell: TableCell | undefined): Amount | undefined => (cell === undefined ? undefined : valueIn(cell.text));

/** A ledger's in or out cell: blank or a dash is zero, written to no step. */
const ledgerAmount = (cell: TableCell | undefined, marks: string): Amount | undefined => {
  if (cell === undefined || NOTHING.test(plain(cell.text))) return { value: 0, step: 0, marks };
  return amountIn(cell);
};

/** The signed change a row makes to the balance, and how far rounding may move it; undefined when the row cannot say. */
type Change = { readonly value: number; readonly step: number };

const loanChange = (row: readonly TableCell[], movement: number, marks: string): Change | undefined => {
  const amount = amountIn(row[movement]);
  return amount === undefined || amount.marks !== marks ? undefined : { value: -amount.value, step: amount.step };
};

/** In a ledger, a row whose in and out cells are both blank says nothing of a change (a brought-forward line). */
const ledgerChange = (row: readonly TableCell[], columns: { in?: number; out?: number }, marks: string): Change | undefined => {
  const cellOf = (index: number | undefined): TableCell | undefined => (index === undefined ? undefined : row[index]);
  const [came, went] = [cellOf(columns.in), cellOf(columns.out)];
  if ([came, went].every((cell) => cell === undefined || NOTHING.test(plain(cell.text)))) return undefined;
  const [inAmount, outAmount] = [ledgerAmount(came, marks), ledgerAmount(went, marks)];
  if (inAmount === undefined || outAmount === undefined || inAmount.marks !== marks || outAmount.marks !== marks) return undefined;
  return { value: inAmount.value - outAmount.value, step: inAmount.step + outAmount.step };
};

const changeOf = (row: readonly TableCell[], columns: BalanceColumns, marks: string): Change | undefined =>
  columns.kind === "loan" ? loanChange(row, columns.movement, marks) : ledgerChange(row, columns, marks);

/** A row number written as a whole number (1, 2, 3) in the sequence column; anything else in it is not counted. */
const WHOLE = /^\d+$/u;
/** Room for the binary fractions of decimal amounts (22,630.95 − 460.01), as a share of the rounding allowed. */
const EPSILON = 1e-6;

const balanceOf = (row: readonly TableCell[], columns: BalanceColumns): Amount | undefined => amountIn(row[columns.balance]);

const isTotalRow = (row: readonly TableCell[], labels: readonly string[]): boolean => {
  const label = plain(row[0]?.text ?? "").toLowerCase();
  return labels.some((word) => holds(label, word));
};

/** The rows are in order: the numbers of the sequence column rise, and a loan's balance is lower at the end than at the start. */
const inOrder = (rows: readonly (readonly TableCell[])[], columns: BalanceColumns, labels: readonly string[]): boolean => {
  const { sequence } = columns;
  const texts = sequence === undefined ? [] : rows.map((row) => plain(row[sequence]?.text ?? ""));
  const numbers = texts.filter((text) => WHOLE.test(text)).map(Number);
  if (numbers.some((number, index) => index > 0 && number <= (numbers[index - 1] ?? 0))) return false;
  const balances = rows.flatMap((row) => (isTotalRow(row, labels) ? [] : (balanceOf(row, columns) ?? [])));
  const [first, last] = [balances[0], balances.at(-1)];
  return columns.kind === "ledger" || first === undefined || last === undefined || last.value <= first.value;
};

/** The expected balance written the way the cell writes its own: the same decimals, thousands commas and marks (¥, 円, $). */
const shownAmount = (value: number, written: Amount, text: string): string => {
  const decimals = Math.max(0, Math.round(-Math.log10(written.step)));
  const useGrouping = text.includes(",");
  const number = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping });
  const [before = "", after = ""] = written.marks.split("|");
  return `${value < 0 ? "-" : ""}${before}${number}${after}`;
};

type Walk = { readonly previous?: Amount; readonly issue?: StructureIssue };

/** One row's step: its balance is what the next row starts from. A row that cannot be read starts the chain again. */
const stepOf = (walk: Walk, row: readonly TableCell[], columns: BalanceColumns, labels: readonly string[]): Walk => {
  const cell = row[columns.balance];
  const balance = balanceOf(row, columns);
  if (walk.issue !== undefined) return walk;
  if (cell === undefined || balance === undefined || isTotalRow(row, labels)) return {};
  const change = changeOf(row, columns, balance.marks);
  const { previous } = walk;
  if (previous === undefined || previous.marks !== balance.marks || change === undefined) return { previous: balance };
  const expected = previous.value + change.value;
  const tolerance = ((previous.step + change.step + balance.step) / 2) * (1 + EPSILON);
  if (Math.abs(expected - balance.value) <= tolerance) return { previous: balance };
  const offset = cell.start + (cell.text.length - cell.text.trimStart().length);
  return { issue: { offset, values: { balance: plain(cell.text), computed: shownAmount(expected, balance, plain(cell.text)) } } };
};

/**
 * Each table's first row whose balance is not the row above's moved by this row. Only the first: a wrong balance makes the
 * next row's sum wrong too, so the walk stops there instead of reporting every row after one slip.
 */
export const runningBalanceMismatches = (tables: readonly ChangeTable[], words: BalanceWords): StructureIssue[] =>
  tables.flatMap((table) => {
    const columns = balanceColumnsOf(
      table.header.map((cell) => cell.text),
      words.columns,
    );
    const rows = table.rows.filter((row) => row.length === table.header.length);
    if (columns === undefined || !inOrder(rows, columns, words.totalLabels)) return [];
    const walk = rows.reduce<Walk>((state, row) => stepOf(state, row, columns, words.totalLabels), {});
    return walk.issue === undefined ? [] : [walk.issue];
  });
