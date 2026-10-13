/**
 * ポイントの明細で、利用金額 × 還元率が獲得ポイントと合わない行。見出しの語（points-earned-column）から利用金額・還元率・
 * 獲得ポイントの列を見つける。還元率は 3%（利用金額の 3/100）か、見出しが何あたりかを言う数（Points per $1 の 3）で、
 * 還元率の列が無い表は、表の前の同じ節の文が言う率（100円ごとに10ポイント）を使う。利用金額と獲得ポイントは単位が違ってよい
 * のは、獲得ポイントの升がポイントの単位（points-unit）で書かれたときだけ。端数は切り捨て・四捨五入・切り上げのどれでもよく、
 * 何円ごとに何ポイントと数える切り捨て（18,450円の 3% を 184 × 3）も合っていると読む。Pure.
 */
import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { TABLE_ROW } from "./runs.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { cellNumber } from "./line-amount.ts";
import { roundedMatches } from "./tax.ts";
import { escapeRegExp } from "../orthography.ts";

export type PointsRole = "base" | "rate" | "earned";
/** A column heading and its role; a rate heading's per is the amount a bare rate is per (Points per $1: 1). */
export type PointsColumnWord = { readonly pattern: string; readonly role: PointsRole; readonly per: number | undefined };
export type PointsWords = {
  readonly columns: readonly PointsColumnWord[];
  /** What a points amount is written in (ポイント, points). */
  readonly units: readonly string[];
  /** What joins a points amount to the money it is per in a sentence (ごとに, for every). */
  readonly joiners: readonly string[];
};

/**
 * value points per `per` of the base's unit: 3% is 3 per 100, 10 points for every $1 is 10 per 1. A rate stated in a
 * sentence keeps the marks of its money ("$|"), and goes only with a base written with the same ones.
 */
export type PointsRate = { readonly value: number; readonly per: number; readonly written: string; readonly marks?: string };

type Columns = { readonly base: number; readonly earned: number; readonly rate: (PointsColumnWord & { readonly index: number }) | undefined };
type CellNumber = NonNullable<ReturnType<typeof cellNumber>>;

const CENTS = 100;
const PERCENT = 100;
const NUMBER = /\d[\d,]*(?:\.\d+)?/u;

const key = (text: string): string => text.normalize("NFKC").replace(/[*_`]/gu, "").trim().toLowerCase();

const valueOf = (written: string): number => Number(written.replaceAll(",", ""));

/**
 * Whether the written points are the base times the rate: rounded down, to nearest or up, or counted per whole step of
 * the base (100円ごとに3ポイント gives 184 × 3 for 18,450円).
 */
export const pointsMatch = (written: number, base: number, rate: PointsRate): boolean => {
  const writtenCents = Math.round(written * CENTS);
  if (roundedMatches(writtenCents, (base * rate.value * CENTS) / rate.per)) return true;
  return Math.abs(Math.floor(base / rate.per) * rate.value * CENTS - writtenCents) < 1;
};

const columnOf = (header: readonly Cell[], words: PointsWords, role: PointsRole): (PointsColumnWord & { index: number })[] =>
  header.flatMap((cell, index) => {
    const word = words.columns.find((entry) => entry.role === role && key(entry.pattern) === key(cell.text));
    return word === undefined ? [] : [{ ...word, index }];
  });

/** The base and earned columns (one each) and the rate column (one or none); undefined when the table is not one. */
const columnsOf = (header: readonly Cell[], words: PointsWords): Columns | undefined => {
  const [bases, earned, rates] = [columnOf(header, words, "base"), columnOf(header, words, "earned"), columnOf(header, words, "rate")];
  const [base, points] = [bases[0], earned[0]];
  if (bases.length !== 1 || earned.length !== 1 || rates.length > 1 || base === undefined || points === undefined) return undefined;
  return { base: base.index, earned: points.index, rate: rates[0] };
};

const isPointsUnit = (mark: string, words: PointsWords): boolean => words.units.some((unit) => key(unit) === key(mark));

/** Points written bare or in a points unit, or in the base's own unit (a cashback in yen); a base in points is not money. */
const unitsFit = (base: CellNumber, earned: CellNumber, words: PointsWords): boolean => {
  if (isPointsUnit(base.after, words) || isPointsUnit(base.before, words)) return false;
  if (earned.before === base.before && earned.after === base.after) return true;
  return earned.before === "" && (earned.after === "" || isPointsUnit(earned.after, words));
};

/** A rate cell: 3% is per 100; a bare number (or one in points) is per what its heading says, and unread when it says nothing. */
export const rateIn = (written: string, per: number | undefined, words: PointsWords): PointsRate | undefined => {
  const rate = cellNumber({ start: 0, text: written });
  if (rate === undefined || rate.before !== "" || rate.value <= 0) return undefined;
  if (rate.after === "%") return { value: rate.value, per: PERCENT, written: rate.written };
  const bare = rate.after === "" || isPointsUnit(rate.after, words);
  return bare && per !== undefined ? { value: rate.value, per, written: rate.written } : undefined;
};

/** Another cell in a points unit (a bonus): the earned points may not be the base times the rate alone. */
const hasOtherPoints = (cells: readonly Cell[], columns: Columns, words: PointsWords): boolean =>
  cells.some((cell, index) => {
    if (index === columns.base || index === columns.earned || index === columns.rate?.index) return false;
    const number = cellNumber(cell);
    return number !== undefined && isPointsUnit(number.after, words);
  });

const shownLike = (earned: CellNumber, exact: number): string => {
  const decimals = earned.decimals;
  const number = (Math.floor(exact * 10 ** decimals) / 10 ** decimals).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: earned.grouped,
  });
  return earned.written.replace(NUMBER, number);
};

/** The row's rate: its rate cell's, or with no rate column the one the section states. */
const rowRate = (cells: readonly Cell[], columns: Columns, stated: PointsRate | undefined, words: PointsWords): PointsRate | undefined => {
  if (columns.rate === undefined) return stated;
  const cell = cells[columns.rate.index];
  return cell === undefined ? undefined : rateIn(cell.text, columns.rate.per, words);
};

const rowIssue = (cells: readonly Cell[], columns: Columns, stated: PointsRate | undefined, words: PointsWords): StructureIssue[] => {
  const [baseCell, earnedCell] = [cells[columns.base], cells[columns.earned]];
  const base = baseCell === undefined ? undefined : cellNumber(baseCell);
  const earned = earnedCell === undefined ? undefined : cellNumber(earnedCell);
  const rate = rowRate(cells, columns, stated, words);
  if (base === undefined || earned === undefined || rate === undefined || !unitsFit(base, earned, words)) return [];
  if (rate.marks !== undefined && rate.marks !== marksOf(base)) return [];
  if (hasOtherPoints(cells, columns, words) || pointsMatch(earned.value, base.value, rate)) return [];
  const expected = shownLike(earned, (base.value * rate.value) / rate.per);
  return [{ offset: earned.offset, values: { written: earned.written, quantity: base.written, price: rate.written, expected } }];
};

const WHOLE = "\\d{1,3}(?:,\\d{3})+|\\d+";
/** What may stand between the money, the joiner and the points: spaces and a comma. */
const GAP = "[\\s、,]*";

const marksOf = (money: CellNumber): string => `${money.before}|${money.after}`;

const alternatives = (words: readonly string[]): string =>
  words
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");

/** "100円ごとに10ポイント" (money, joiner, points) and "10 points for every $1" (points, joiner, money), next to each other. */
const statementPatterns = (base: CellNumber, words: PointsWords): RegExp[] => {
  const money = `${escapeRegExp(base.before)}\\s*(?<money>${WHOLE})(?![.,]?\\d)\\s*${escapeRegExp(base.after)}`;
  const points = `(?<pointsText>(?<![\\d,.])(?<points>${WHOLE})\\s*(?:${alternatives(words.units)}))`;
  const joiner = `(?:${alternatives(words.joiners)})`;
  return [`${money}${GAP}${joiner}${GAP}${points}`, `${points}${GAP}${joiner}${GAP}${money}`].map((pattern) => new RegExp(pattern, "giu"));
};

/** The one rate a line states (10 points for every $1), undefined when it states none or more than one. */
export const statedRateIn = (text: string, base: CellNumber, words: PointsWords): PointsRate | undefined => {
  if ((base.before === "" && base.after === "") || words.units.length === 0 || words.joiners.length === 0) return undefined;
  const statements = statementPatterns(base, words).flatMap((pattern) => [...text.normalize("NFKC").matchAll(pattern)]);
  const groups = statements.length === 1 ? statements[0]?.groups : undefined;
  const [value, per, written] = [groups?.["points"], groups?.["money"], groups?.["pointsText"]];
  if (value === undefined || per === undefined || written === undefined || valueOf(per) <= 0) return undefined;
  return { value: valueOf(value), per: valueOf(per), written: `${written}/${base.before}${per}${base.after}`, marks: marksOf(base) };
};

/** The rate the prose of the table's section states before it, when every statement there gives the same one. */
const sectionRate = (prose: readonly Line[], from: number, to: number, base: CellNumber, words: PointsWords): PointsRate | undefined => {
  const rates = prose.filter((line) => line.start >= from && line.start < to).flatMap((line) => statedRateIn(line.text, base, words) ?? []);
  return new Set(rates.map((rate) => `${String(rate.value)}/${String(rate.per)}`)).size === 1 ? rates[0] : undefined;
};

const firstBase = (rows: readonly Line[], columns: Columns): CellNumber | undefined =>
  rows.flatMap((row) => {
    const cell = cellsOf(row)[columns.base];
    return cell === undefined ? [] : (cellNumber(cell) ?? []);
  })[0];

/** Each row of a points table whose earned points are not the base times the rate. headings: where each heading starts. */
export const pointsMismatches = (source: string, headings: readonly number[], words: PointsWords): StructureIssue[] => {
  if (words.columns.length === 0) return [];
  const lines = linesOf(source);
  const prose = lines.filter((line) => !TABLE_ROW.test(line.text) && line.text.trim() !== "");
  return tablesOf(lines).flatMap(({ header, rows }) => {
    const columns = columnsOf(cellsOf(header), words);
    if (columns === undefined) return [];
    const from = Math.max(0, ...headings.filter((start) => start <= header.start));
    const base = firstBase(rows, columns);
    const stated = columns.rate === undefined && base !== undefined ? sectionRate(prose, from, header.start, base, words) : undefined;
    return rows.flatMap((row) => rowIssue(cellsOf(row), columns, stated, words));
  });
};
