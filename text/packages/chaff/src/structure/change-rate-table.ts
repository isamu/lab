// change-rate-mismatch in a table: a row with the earlier value, the later one and the rate of change, each in a column the
// header names (「| 売上高 | 1,200 | 1,320 | 12.0% |」 under 前期 / 当期 / 増減率, "Prior year / Current year / YoY"). Pure.
import type { Span } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";
import { disagreeingRate } from "./change-rate.ts";
import { escapeRegExp } from "../orthography.ts";

export type ColumnRole = "base" | "current" | "rate" | "change";
export type ColumnWord = { readonly pattern: string; readonly role: ColumnRole };
export type TableCell = Span & { readonly text: string };
export type ChangeTable = { readonly header: readonly TableCell[]; readonly rows: readonly (readonly TableCell[])[] };

/** Rate words first: 「前期比」 holds 前期 and "change vs prior year" holds "prior year", and both are rates. */
const ROLE_ORDER: readonly ColumnRole[] = ["rate", "change", "base", "current"];
const LATIN = /[a-z]/u;
/** A calendar year in a heading (FY2025, 2025年3月期, 2026年度), not part of a longer number. */
const YEAR = /(?<!\d|\d[.,])(?:1[89]|2[01])\d{2}(?!\d|[.,]\d)/gu;
const PERCENT_MARK = /%/u;
/** A rate cell: a sign (+, -, −, ▲, △), the number, and % when the cell carries it. 1.2pt, (5.0)% and — are not rates. */
const RATE_CELL = /^([+\-−▲△])?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(%)?$/u;
/** A value cell: the number with what is written around it (¥, $, 百万円, million), and no sign, bracket or %. */
const VALUE_CELL = /^([^\d+\-−▲△()%]*?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?([^\d+\-−▲△()%]*)$/u;
const NEGATIVE_SIGNS: ReadonlySet<string> = new Set(["-", "−", "▲", "△"]);
const DECIMAL_BASE = 10;

const plain = (text: string): string => text.normalize("NFKC").replace(/[*_`]/gu, "").trim();

/** A Latin word stands as a whole word (change is not in "exchange"); anything else as written. */
const holds = (heading: string, word: string): boolean => {
  const key = plain(word).toLowerCase();
  if (!LATIN.test(key)) return heading.includes(key);
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(key)}(?![a-z0-9])`, "u").test(heading);
};

const roleOf = (heading: string, words: readonly ColumnWord[]): ColumnRole | undefined => {
  const key = plain(heading).toLowerCase();
  return ROLE_ORDER.find((role) => words.some((word) => word.role === role && holds(key, word.pattern)));
};

const onlyIndex = (indexes: readonly number[]): number | undefined => (indexes.length === 1 ? indexes[0] : undefined);

type Columns = { readonly base: number; readonly current: number; readonly rate: number; readonly percentOnly: boolean };

/** Two columns each headed by one calendar year and no word of role: the earlier year's is the earlier value. */
const datedColumns = (headings: readonly string[], roles: readonly (ColumnRole | undefined)[]): { base: number; current: number } | undefined => {
  const dated = headings.flatMap((heading, index) => {
    const years = [...plain(heading).matchAll(YEAR)].map((match) => Number(match[0]));
    const [year] = years;
    return years.length === 1 && year !== undefined && roles[index] === undefined ? [{ index, year }] : [];
  });
  const [first, second] = dated;
  if (dated.length !== 2 || first === undefined || second === undefined || first.year === second.year) return undefined;
  return first.year < second.year ? { base: first.index, current: second.index } : { base: second.index, current: first.index };
};

/** What a heading writes in brackets, less its numbers: 「（百万円）」, "(thousand yen)"; 「（2025年3月期）」 keeps only 「年月期」. */
const BRACKETED = /[(（]([^)）]*)[)）]/gu;
const bracketedOf = (heading: string): string =>
  [...plain(heading).matchAll(BRACKETED)].map((match) => (match[1] ?? "").replace(/[\d.,]/gu, "").trim()).join("|");

/** The two period columns do not name different units in their headings ("FY2025 (thousand yen)", "FY2026 (million yen)"). */
const sameHeadingUnits = (base: string | undefined, current: string | undefined): boolean => bracketedOf(base ?? "") === bracketedOf(current ?? "");

/** The one column of each role. A rate column is one headed by a rate word, else the one change column whose cells carry %. */
export const columnsOf = (headings: readonly string[], words: readonly ColumnWord[]): Columns | undefined => {
  const roles = headings.map((heading) => roleOf(heading, words));
  const indexesOf = (role: ColumnRole): number[] => roles.flatMap((found, index) => (found === role ? [index] : []));
  const rateColumn = onlyIndex(indexesOf("rate"));
  const changeColumn = indexesOf("rate").length === 0 ? onlyIndex(indexesOf("change")) : undefined;
  const rate = rateColumn ?? changeColumn;
  const [base, current] = [onlyIndex(indexesOf("base")), onlyIndex(indexesOf("current"))];
  const periods = base !== undefined && current !== undefined ? { base, current } : datedColumns(headings, roles);
  if (rate === undefined || periods === undefined || !sameHeadingUnits(headings[periods.base], headings[periods.current])) return undefined;
  return { ...periods, rate, percentOnly: rateColumn === undefined && !PERCENT_MARK.test(plain(headings[rate] ?? "")) };
};

type WrittenRate = { readonly sign: string; readonly value: number; readonly decimals: number; readonly digits: string };

/** The signed rate a cell writes, undefined when it is not one (1.2pt, (5.0)%, —) or lacks the % its column needs. */
export const rateIn = (text: string, percentOnly: boolean): WrittenRate | undefined => {
  const match = RATE_CELL.exec(plain(text));
  if (match === null || (percentOnly && match[4] === undefined)) return undefined;
  const [, sign = "", whole = "", fraction = ""] = match;
  const magnitude = Number(`${whole.replaceAll(",", "")}${fraction === "" ? "" : `.${fraction}`}`);
  const digits = `${whole}${fraction === "" ? "" : `.${fraction}`}`;
  return { sign, value: NEGATIVE_SIGNS.has(sign) ? -magnitude : magnitude, decimals: fraction.length, digits };
};

type WrittenValue = { readonly value: number; readonly step: number; readonly marks: string };

/** The value a cell writes, with what stands around the number (¥, 百万円, million) as the unit to compare. */
export const valueIn = (text: string): WrittenValue | undefined => {
  const match = VALUE_CELL.exec(plain(text));
  if (match === null) return undefined;
  const [, before = "", whole = "", fraction = "", after = ""] = match;
  const value = Number(`${whole.replaceAll(",", "")}${fraction === "" ? "" : `.${fraction}`}`);
  return { value, step: DECIMAL_BASE ** -fraction.length, marks: `${before.trim()}|${after.trim()}` };
};

/** The computed rate written the way the cell writes its sign: 「△5.3」 beside 「△5.0」, "+10.0" beside "+12.0". */
const shownRate = (computed: number, written: WrittenRate): string => {
  const magnitude = Math.abs(computed).toFixed(written.decimals);
  if (computed < 0) return `${NEGATIVE_SIGNS.has(written.sign) ? written.sign : "-"}${magnitude}`;
  return `${written.sign === "+" ? "+" : ""}${magnitude}`;
};

const issueInRow = (row: readonly TableCell[], columns: Columns): StructureIssue[] => {
  const [baseCell, currentCell, rateCell] = [row[columns.base], row[columns.current], row[columns.rate]];
  const base = baseCell === undefined ? undefined : valueIn(baseCell.text);
  const current = currentCell === undefined ? undefined : valueIn(currentCell.text);
  const rate = rateCell === undefined ? undefined : rateIn(rateCell.text, columns.percentOnly);
  if (rateCell === undefined || base === undefined || current === undefined || rate === undefined || base.marks !== current.marks) return [];
  const computed = disagreeingRate(base, current, rate.value, rate.decimals);
  if (computed === undefined) return [];
  const offset = rateCell.start + (rateCell.text.length - rateCell.text.trimStart().length);
  return [{ offset, values: { rate: `${rate.sign}${rate.digits}`, computed: shownRate(computed, rate) } }];
};

/** Each row whose rate of change the two values in the columns the header names do not give. */
export const tableRateMismatches = (tables: readonly ChangeTable[], words: readonly ColumnWord[]): StructureIssue[] =>
  tables.flatMap((table) => {
    const columns = columnsOf(
      table.header.map((cell) => cell.text),
      words,
    );
    if (columns === undefined) return [];
    return table.rows.filter((row) => row.length === table.header.length).flatMap((row) => issueInRow(row, columns));
  });
