/**
 * closing-balance-mismatch: the deciding half. A closing balance (当月末残高, Closing balance) against the opening balance
 * (前月末残高, Opening balance) plus the total paid in (お預入れ合計, Total deposits) less the total paid out (お引出し合計,
 * Total withdrawals), written in the same table or the same section. Which words name them is data (lexicon
 * closing-balance-label, grouped opening / inflow / outflow / closing); an amount is read as net-amount-mismatch reads one.
 * Pure.
 */
import { keyOf, labelKey, noteOf } from "./ratio.ts";
import { amountOf, isExact, shown, type LabelledLine, type NetAmount, type NetCell, type NetIssue, type NetWords } from "./net-amount.ts";

export const BALANCE_ROLES = ["opening", "inflow", "outflow", "closing"] as const;
export type BalanceRole = (typeof BALANCE_ROLES)[number];

export type BalanceWords = Pick<NetWords, "magnitudes" | "percentUnits"> & {
  readonly labels: Readonly<Record<BalanceRole, readonly string[]>>;
  /** Words that make a label's note the date the balance is taken on (時点, as of): such a note is not a unit. */
  readonly asOf?: readonly string[] | undefined;
};

export type BalanceAmount = NetAmount & { readonly role: BalanceRole };

const DECIMAL_BASE = 10;
const HALF = 0.5;
/** Four amounts each rounded on their own to nearest may leave the sum off by up to two steps of the coarsest digit. */
const ROUNDED_STEPS = 2;

export const balanceRoleOf = (label: string, words: BalanceWords): BalanceRole | undefined =>
  BALANCE_ROLES.find((role) => words.labels[role].some((pattern) => keyOf(pattern) === labelKey(label)));

/** The one amount of a role in a scope; undefined when the role is missing or written more than once. */
const onlyAmount = (amounts: readonly BalanceAmount[], role: BalanceRole): BalanceAmount | undefined => {
  const mine = amounts.filter((amount) => amount.role === role);
  return mine.length === 1 ? mine[0] : undefined;
};

const allowedGap = (amounts: readonly BalanceAmount[], words: BalanceWords): number => {
  const finest = Math.max(...amounts.map((amount) => amount.decimals));
  const coarsest = Math.min(...amounts.map((amount) => amount.decimals));
  const exact = amounts.every((amount) => isExact(amount, words));
  return HALF * DECIMAL_BASE ** -finest + (exact ? 0 : ROUNDED_STEPS * DECIMAL_BASE ** -coarsest);
};

/**
 * One scope: opening, inflow, outflow and closing each found once, all in one unit. The closing balance is reported when it
 * is not opening + inflow − outflow beyond rounding. A sum below zero is not compared: an overdrawn balance is written with
 * a sign, which is not read as an amount.
 */
export const closingMismatch = (amounts: readonly BalanceAmount[], words: BalanceWords): NetIssue | undefined => {
  const found = BALANCE_ROLES.map((role) => onlyAmount(amounts, role));
  const [opening, inflow, outflow, closing] = found;
  if (opening === undefined || inflow === undefined || outflow === undefined || closing === undefined) return undefined;
  const four = [opening, inflow, outflow, closing];
  if (four.some((amount) => amount.unit !== closing.unit)) return undefined;
  const decimals = Math.max(...four.map((amount) => amount.decimals));
  const expected = Math.round((opening.value + inflow.value - outflow.value) * DECIMAL_BASE ** decimals) / DECIMAL_BASE ** decimals;
  if (!Number.isSafeInteger(Math.round(expected * DECIMAL_BASE ** decimals))) return undefined;
  if (expected < 0 || Math.abs(expected - closing.value) <= allowedGap(four, words)) return undefined;
  return { offset: closing.start, values: { written: closing.written, expected: shown(expected, closing, decimals) } };
};

const DIGIT = /\d/u;

/** A note naming the date a balance is taken on (（2026年6月30日時点）, (as of June 30, 2026)): a date, not a unit. */
export const isDatedNote = (note: string, asOf: readonly string[]): boolean => {
  const key = keyOf(note);
  return DIGIT.test(key) && asOf.some((word) => key.includes(keyOf(word)));
};

const CURRENCY_CODE = /\b[A-Z]{3}\b/u;

/** A note that names a scale or a currency besides the date ((thousand yen, as of June 30, 2026)) still names a unit. */
const namesUnitToo = (note: string, words: BalanceWords): boolean =>
  CURRENCY_CODE.test(note.normalize("NFKC")) || words.magnitudes.some((word) => keyOf(note).includes(keyOf(word)));

/** The note of a label that may give its amount a unit: a note that only dates it gives none, so dated and undated rows compare. */
const unitNoteOf = (label: string, words: BalanceWords): string => {
  const note = noteOf(label);
  return isDatedNote(note, words.asOf ?? []) && !namesUnitToo(note, words) ? "" : note;
};

/** A column heading that is a word with no digit or bracket (ポイント, Points): the unit of the bare numbers under it. */
const UNIT_HEADING = /^[^\d()[\]（）]+$/u;
const BARE_MARKS = "||";

/**
 * A bare number under a heading naming its unit compares with the cells that write the unit out (14,310 under ポイント,
 * against 4,960ポイント). Its marks stay empty, so it is still read as possibly rounded.
 */
export const withHeadingUnit = (amount: NetAmount, heading: string | undefined): NetAmount => {
  const unit = keyOf(heading ?? "");
  if (amount.prefix + amount.suffix !== "" || !UNIT_HEADING.test(unit)) return amount;
  return { ...amount, unit: `|${unit}|${amount.unit.slice(BARE_MARKS.length)}` };
};

const labelledCells = (labels: readonly NetCell[], values: readonly NetCell[], words: BalanceWords, heading?: string): BalanceAmount[] =>
  labels.flatMap((label, column) => {
    const role = balanceRoleOf(label.text, words);
    const value = values[column];
    const amount = role === undefined || value === undefined ? undefined : amountOf(value.text, value.start, unitNoteOf(label.text, words), words);
    return role === undefined || amount === undefined ? [] : [{ ...withHeadingUnit(amount, heading), role }];
  });

const issuesOf = (scopes: readonly (readonly BalanceAmount[])[], words: BalanceWords): NetIssue[] =>
  scopes.flatMap((amounts) => {
    const issue = closingMismatch(amounts, words);
    return issue === undefined ? [] : [issue];
  });

/** A table whose header names the four columns (one month a row): each body row of the same width is one scope. */
const byColumns = (header: readonly NetCell[], rows: readonly (readonly NetCell[])[], words: BalanceWords): NetIssue[] =>
  issuesOf(
    rows.filter((row) => row.length === header.length).map((row) => labelledCells(header, row, words)),
    words,
  );

/** A table whose rows are labelled in their first cell: each column after the labels is one scope, under its heading. */
const byRows = (header: readonly NetCell[], rows: readonly (readonly NetCell[])[], words: BalanceWords): NetIssue[] => {
  const labelled = rows.filter((row) => row[0] !== undefined && balanceRoleOf(row[0].text, words) !== undefined);
  const width = labelled[0]?.length ?? 0;
  if (labelled.length === 0 || labelled.some((row) => row.length !== width)) return [];
  const columns = Array.from({ length: width - 1 }, (_, index) => index + 1);
  return issuesOf(
    columns.map((column) => labelled.flatMap((row) => labelledCells(row.slice(0, 1), row.slice(column, column + 1), words, header[column]?.text))),
    words,
  );
};

/**
 * One table, read both ways. A table of transactions with a running balance (日付, お預入れ, お引出し, 残高) names none of the
 * four totals in its header or its first column, so it gives no scope; running-balance-mismatch reads it row by row.
 */
export const tableClosingMismatches = (header: readonly NetCell[], rows: readonly (readonly NetCell[])[], words: BalanceWords): NetIssue[] => {
  const issues = [...byColumns(header, rows, words), ...byRows(header, rows, words)];
  return issues.filter((issue, index) => issues.findIndex((other) => other.offset === issue.offset) === index);
};

/** The labelled lines of one section (前月末残高：412,350円). */
export const sectionClosingMismatch = (lines: readonly LabelledLine[], words: BalanceWords): NetIssue | undefined =>
  closingMismatch(
    lines.flatMap((line) => labelledCells([{ start: 0, text: line.label }], [line.value], words)),
    words,
  );
