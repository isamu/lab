// share-amount-mismatch: the amount a patient pays that is not the stated share (3割, 30%) of the total beside it. Two
// shapes: a table whose headings name the total, the share and the amount, read row by row; and labelled lines
// (「合計：10,000円」 then 「自己負担額（3割）：3,500円」) in one section, the total above the amount. Pure.
import type { Line } from "./lines.ts";
import type { StructureIssue } from "./issues.ts";
import { holds, plain, valueIn, type ChangeTable, type TableCell } from "./change-rate-table.ts";
import { bodyRows, offsetOf } from "./order-quantity.ts";
import { taxMatches } from "./tax.ts";

/** base: the total the share is of. share: a share, written as a rate (負担割合 3割) or as the amount (負担額 3,000円). paid: only the amount. */
export type ShareRole = "base" | "share" | "paid";
export type ShareWord = { readonly pattern: string; readonly role: ShareRole };
/** An amount written in this unit may be rounded to this step (円: 10, the 10-yen rounding of a patient's share). */
export type ShareRounding = { readonly unit: string; readonly step: number };
export type ShareWords = { readonly labels: readonly ShareWord[]; readonly roundings: readonly ShareRounding[] };
/** The document's tables, its lines outside tables, and where each heading starts (a section ends there). */
export type ShareText = { readonly tables: readonly ChangeTable[]; readonly lines: readonly Line[]; readonly headings: readonly number[] };

export type ShareRate = { readonly value: number; readonly written: string };
export type Money = { readonly value: number; readonly decimals: number; readonly marks: string; readonly offset: number; readonly text: string };

const ROLE_ORDER: readonly ShareRole[] = ["paid", "share", "base"];
const PERCENT_RATE = /^(\d{1,2}(?:\.\d{1,2})?)\s*%$/u;
/** 3割 is 30%: the Japanese share written in tenths. */
const TENTHS_RATE = /^([1-9])\s*割$/u;
const TENTH = 10;
const MAX_RATE = 100;
const CENTS = 100;
const BRACKETED = /\(([^()]*)\)/gu;
const NUMBER = /\d[\d,]*(?:\.(\d+))?/u;
/** A line that is one label and one value: 「合計：10,000円」, "- Your share (30%): $350.00". */
const SEPARATOR = /[:：]/u;
const LIST_MARKER = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/u;
const KEY_VALUE_CELLS = 2;

/** A share written as a rate: 30%, 30 %, 3割. Undefined for anything else, 0 and 100% and more. */
export const shareRateIn = (text: string): ShareRate | undefined => {
  const written = plain(text);
  const percent = PERCENT_RATE.exec(written)?.[1];
  const tenths = TENTHS_RATE.exec(written)?.[1];
  const value = percent === undefined ? Number(tenths) * TENTH : Number(percent);
  return Number.isFinite(value) && value > 0 && value < MAX_RATE ? { value, written } : undefined;
};

/** A rate written in brackets in a label: 「自己負担額（3割）」, "Your share (30%)". */
const bracketedRate = (label: string): ShareRate | undefined => {
  const rates = [...plain(label).matchAll(BRACKETED)].flatMap((match) => {
    const rate = shareRateIn(match[1] ?? "");
    return rate === undefined ? [] : [rate];
  });
  return rates.length === 1 ? rates[0] : undefined;
};

const roleOf = (label: string, words: readonly ShareWord[]): ShareRole | undefined => {
  const key = plain(label).toLowerCase();
  return ROLE_ORDER.find((role) => words.some((word) => word.role === role && holds(key, word.pattern)));
};

/** An amount: a number with what is written around it (10,000円, $600.00), not a rate. */
const moneyIn = (text: string, offset: number): Money | undefined => {
  const value = valueIn(text);
  if (value === undefined || shareRateIn(text) !== undefined) return undefined;
  const decimals = NUMBER.exec(plain(text))?.[1]?.length ?? 0;
  return { value: value.value, decimals, marks: value.marks, offset, text: plain(text) };
};

const stepOf = (money: Money, roundings: readonly ShareRounding[]): number | undefined => {
  const units = money.marks.split("|");
  return roundings.find((rounding) => units.includes(plain(rounding.unit)))?.step;
};

/**
 * Whether the written amount is the rate of the base: rounded down, to nearest or up, to the cent or the unit (the
 * arithmetic of tax-mismatch), or to the rounding step of its unit.
 */
export const shareMatches = (written: number, base: number, rate: number, step: number | undefined): boolean => {
  const writtenCents = Math.round(written * CENTS);
  if (taxMatches(writtenCents, base, rate)) return true;
  if (step === undefined) return false;
  const stepCents = step * CENTS;
  return [Math.floor, Math.round, Math.ceil].some((round) => Math.abs(round((base * rate) / stepCents) * stepCents - writtenCents) < 1);
};

/** The expected amount written the way the amount is: its unit, its grouping, its decimals, rounded to its step. */
export const shownLike = (money: Money, exact: number, step: number | undefined): string => {
  const rounded = step === undefined ? exact : Math.round(exact / step) * step;
  const number = rounded.toLocaleString("en-US", {
    minimumFractionDigits: money.decimals,
    maximumFractionDigits: money.decimals,
    useGrouping: money.text.includes(","),
  });
  return money.text.replace(NUMBER, number);
};

const issueOf = (base: Money, amount: Money, rate: ShareRate, roundings: readonly ShareRounding[]): StructureIssue[] => {
  const step = stepOf(amount, roundings);
  if (base.marks !== amount.marks || shareMatches(amount.value, base.value, rate.value, step)) return [];
  const expected = shownLike(amount, (base.value * rate.value) / MAX_RATE, step);
  return [{ offset: amount.offset, values: { written: amount.text, expected, rate: rate.written, base: base.text } }];
};

const onlyOne = <T>(items: readonly T[]): T | undefined => (items.length === 1 ? items[0] : undefined);

type Labelled = { readonly label: string; readonly value: string; readonly offset: number };

const labelledLine = (line: Line): Labelled | undefined => {
  const at = line.text.search(SEPARATOR);
  const label = line.text.slice(0, Math.max(at, 0)).replace(LIST_MARKER, "").trim();
  const after = line.text.slice(at + 1);
  const value = after.trim();
  if (at < 0 || label === "" || value === "") return undefined;
  return { label, value, offset: line.start + at + 1 + after.length - after.trimStart().length };
};

/** The share rate the document states on lines of their own (「負担割合：3割」, "Patient share: 30%"); undefined when none or two different ones. */
export const statedRate = (labelled: readonly Labelled[], words: readonly ShareWord[]): ShareRate | undefined => {
  const rates = labelled.flatMap((line) => {
    const rate = roleOf(line.label, words) === "share" ? shareRateIn(line.value) : undefined;
    return rate === undefined ? [] : [rate];
  });
  return new Set(rates.map((rate) => rate.value)).size === 1 ? rates[0] : undefined;
};

type Context = { readonly words: ShareWords; readonly stated: ShareRate | undefined };

/** One row of a table: the total, the one amount, and the rate in the row, else in the amount's heading, else the stated one. */
const rowIssues = (
  row: readonly TableCell[],
  headings: readonly TableCell[],
  roles: readonly (ShareRole | undefined)[],
  baseColumn: number,
  context: Context,
): StructureIssue[] => {
  const baseCell = row[baseColumn];
  const base = baseCell === undefined ? undefined : moneyIn(baseCell.text, offsetOf(baseCell));
  const at = (role: ShareRole): number[] => roles.flatMap((found, index) => (found === role ? [index] : []));
  const rowRates = at("share").flatMap((index) => {
    const rate = shareRateIn(row[index]?.text ?? "");
    return rate === undefined ? [] : [rate];
  });
  const amounts = [...at("share"), ...at("paid")].flatMap((index) => {
    const cell = row[index];
    const money = cell === undefined ? undefined : moneyIn(cell.text, offsetOf(cell));
    return money === undefined ? [] : [{ money, index }];
  });
  const amount = onlyOne(amounts);
  if (base === undefined || amount === undefined || rowRates.length > 1) return [];
  const rowRate = onlyOne(rowRates);
  // An amount column named only as a payment (Amount paid) is the share only beside a rate column in the same row.
  const rate = rowRate ?? (roles[amount.index] === "share" ? (bracketedRate(headings[amount.index]?.text ?? "") ?? context.stated) : undefined);
  return rate === undefined ? [] : issueOf(base, amount.money, rate, context.words.roundings);
};

const tableIssues = (table: ChangeTable, context: Context): StructureIssue[] => {
  const roles = table.header.map((cell) => roleOf(cell.text, context.words.labels));
  const baseColumn = onlyOne(roles.flatMap((role, index) => (role === "base" ? [index] : [])));
  if (baseColumn === undefined) return [];
  return bodyRows(table).flatMap((row) => rowIssues(row, table.header, roles, baseColumn, context));
};

/** The two-cell rows of a table that names no total column: | 合計 | 10,000円 |. */
const keyValueRows = (table: ChangeTable, words: readonly ShareWord[]): Labelled[] =>
  table.header.some((cell) => roleOf(cell.text, words) === "base")
    ? []
    : bodyRows(table).flatMap((row) => {
        const [label, value] = row;
        return row.length === KEY_VALUE_CELLS && label !== undefined && value !== undefined
          ? [{ label: label.text, value: value.text, offset: offsetOf(value) }]
          : [];
      });

const sectionOf = (offset: number, headings: readonly number[]): number => headings.filter((start) => start <= offset).length;

/** Labelled lines of one section: the one total, and below it the one amount named as a share. */
const sectionIssues = (section: readonly Labelled[], context: Context): StructureIssue[] => {
  const moneyOf = (line: Labelled): Money | undefined => moneyIn(line.value, line.offset);
  const bases = section.filter((line) => roleOf(line.label, context.words.labels) === "base" && moneyOf(line) !== undefined);
  const amounts = section.filter((line) => roleOf(line.label, context.words.labels) === "share" && moneyOf(line) !== undefined);
  const [baseLine, amountLine] = [onlyOne(bases), onlyOne(amounts)];
  if (baseLine === undefined || amountLine === undefined || baseLine.offset > amountLine.offset) return [];
  const [base, amount] = [moneyOf(baseLine), moneyOf(amountLine)];
  const rate = bracketedRate(amountLine.label) ?? context.stated;
  return base === undefined || amount === undefined || rate === undefined ? [] : issueOf(base, amount, rate, context.words.roundings);
};

const labelledIssues = (labelled: readonly Labelled[], headings: readonly number[], context: Context): StructureIssue[] => {
  const sections = [...new Set(labelled.map((line) => sectionOf(line.offset, headings)))];
  return sections.flatMap((section) =>
    sectionIssues(
      labelled.filter((line) => sectionOf(line.offset, headings) === section),
      context,
    ),
  );
};

/** Each amount charged as a share that is not that share of the total beside it. */
export const shareAmountMismatches = (text: ShareText, words: ShareWords): StructureIssue[] => {
  if (words.labels.length === 0) return [];
  const lines = text.lines.flatMap((line) => labelledLine(line) ?? []);
  const rows = text.tables.flatMap((table) => keyValueRows(table, words.labels));
  const labelled = [...lines, ...rows].toSorted((left, right) => left.offset - right.offset);
  const context = { words, stated: statedRate(labelled, words.labels) };
  return [...text.tables.flatMap((table) => tableIssues(table, context)), ...labelledIssues(labelled, text.headings, context)].toSorted(
    (left, right) => left.offset - right.offset,
  );
};
