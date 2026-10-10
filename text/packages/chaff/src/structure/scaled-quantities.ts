import type { Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { measuredValues, type MeasureUnit } from "../facts/measures.ts";
import { hasSuperscriptPower } from "../facts/superscript-power.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { linesOf, type Line } from "./lines.ts";
import type { Mark } from "./time-marks.ts";

/**
 * A table with one column per number of servings or batch size (4人分 / 8人分, Serves 4 / Serves 8, ×1 / ×2), and the one
 * row that does not grow by the columns' ratio while the others do. The words come from the language packages. Pure.
 */
export type ScaleWords = {
  /** What marks a column as a number of servings (人分 after the number, Serves before it). */
  readonly columns: readonly Mark[];
  /** An amount that is left to the cook (少々, to taste): its row may stay as it is. */
  readonly unscaled: readonly string[];
  /** Spellings of one unit (teaspoon, teaspoons, tsp), each named by its group. */
  readonly unitForms: readonly { readonly pattern: string; readonly group: string }[];
  /** Units with a factor to a base unit (g and kg), so 1 kg and 1000 g read as one amount. */
  readonly measures: readonly MeasureUnit[];
};

/** amount is in the base unit when the unit has a factor (1 kg is 1000); written is the number as written (1). */
export type Amount = { readonly amount: number; readonly written: number; readonly unit: string };

export type ScaleSlip = {
  /** The row's first cell: the item. */
  readonly item: Cell;
  /** The cell that does not scale, and the column it is in. */
  readonly cell: Cell;
  readonly heading: string;
  /** The cell it is compared with, and that column. */
  readonly other: Cell;
  readonly otherHeading: string;
  /** What the cell would hold if it scaled like the other rows, in the unit it is written in. */
  readonly expected: number;
  readonly scaledRows: number;
};

/** Fewer rows than this that scale exactly are no evidence that the table scales at all. */
export const MIN_SCALED_ROWS = 3;
const SAME = 1e-9;
const MIN_COLUMNS = 2;

const NUMBER_TEXT = "[0-9]+(?:\\.[0-9]+)?";

/** The number of servings a column heading names (4人分, Serves 8, ×2), or undefined. */
export const servingsOf = (heading: string, marks: readonly Mark[]): number | undefined => {
  const text = withoutEdgeMarks(heading.normalize("NFKC").trim()).toLowerCase();
  const read = marks
    .map((mark) => {
      const word = escapeRegExp(mark.pattern.normalize("NFKC").toLowerCase());
      const pattern = mark.position === "before" ? `^${word}\\s*(${NUMBER_TEXT})$` : `^(${NUMBER_TEXT})\\s*${word}$`;
      return new RegExp(pattern, "u").exec(text)?.[1];
    })
    .find((number) => number !== undefined);
  const servings = read === undefined ? undefined : Number(read);
  return servings === undefined || !Number.isFinite(servings) || servings <= 0 ? undefined : servings;
};

/** A whole or decimal number (1,000 and 1.5), with a fraction after it (1 1/2) or as a fraction (1/2, ½). */
const WHOLE = String.raw`[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?`;
const FRACTION = String.raw`(?:\s([0-9]+)[/⁄]([0-9]+)|[/⁄]([0-9]+))?`;
const AMOUNT = new RegExp(String.raw`(?<![\p{N}.,/⁄])(${WHOLE})${FRACTION}(?![\p{N}/⁄])`, "gu");

const valueOf = (match: RegExpMatchArray): number => {
  const whole = Number((match[1] ?? "").replace(/,/gu, ""));
  if (match[4] !== undefined) return whole / Number(match[4]);
  return match[2] === undefined ? whole : whole + Number(match[2]) / Number(match[3]);
};

const LETTER_BEFORE = "(?<!\\p{L})";
const LETTER_AFTER = "(?!\\p{L})";

/** The cell's text with its number taken out and each spelling of a unit written as its group: "2 teaspoons" is "#teaspoon". */
const unitKey = (text: string, numberAt: Span, forms: ScaleWords["unitForms"]): string => {
  const rest = `${text.slice(0, numberAt.start)}#${text.slice(numberAt.end)}`.toLowerCase();
  const groups = new Map(forms.map((form) => [form.pattern.toLowerCase(), form.group]));
  const spellings = [...groups.keys()].filter((pattern) => pattern !== "").toSorted((left, right) => right.length - left.length);
  const grouped =
    spellings.length === 0
      ? rest
      : rest.replace(
          new RegExp(`${LETTER_BEFORE}(?:${spellings.map(escapeRegExp).join("|")})${LETTER_AFTER}`, "gu"),
          (spelling) => `<${groups.get(spelling) ?? spelling}>`,
        );
  return grouped.replace(/\s+/gu, "");
};

/** NFKC writes ½ as 1⁄2, so 1½ would read as 11⁄2: a space keeps the whole number apart (1 1⁄2). */
const VULGAR_AFTER_DIGIT = /([0-9０-９])([¼½¾⅐-⅞])/gu;

const normalized = (cellText: string): string => withoutEdgeMarks(cellText.replace(VULGAR_AFTER_DIGIT, "$1 $2").normalize("NFKC").trim());

/** The lexicon's units as NFKC writes them (m² and ㎡ are m2), so they match a cell that has been through NFKC. */
const nfkcMeasures = (measures: readonly MeasureUnit[]): MeasureUnit[] => measures.map((unit) => ({ ...unit, pattern: unit.pattern.normalize("NFKC") }));

/** The cell's first number with a measure unit after it that ends the cell. A digit inside the unit (the 2 of m2) is not a second number. */
const measuredAmount = (text: string, numbers: readonly RegExpMatchArray[], measures: readonly MeasureUnit[]): Amount | undefined => {
  const [first] = numbers;
  const [measured] = measuredValues(text, measures);
  const factor = measured?.factors[0];
  if (first === undefined || measured === undefined || factor === undefined) return undefined;
  if (measured.start !== first.index || measured.end !== text.length) return undefined;
  const unitStart = measured.end - measured.unit.length;
  if (numbers.some((number) => number !== first && (number.index ?? 0) < unitStart)) return undefined;
  return { amount: measured.amount * factor, written: measured.amount, unit: `=${measured.dimension}` };
};

/** One cell's amount and the unit it is in. undefined when the cell holds no number, or more than one (1と1/2, 2 (300 g), 10³). */
export const amountOf = (cellText: string, words: ScaleWords): Amount | undefined => {
  if (hasSuperscriptPower(cellText)) return undefined;
  const text = normalized(cellText);
  const numbers = [...text.matchAll(AMOUNT)];
  const measured = measuredAmount(text, numbers, nfkcMeasures(words.measures));
  if (measured !== undefined) return measured;
  const [only] = numbers;
  if (numbers.length !== 1 || only === undefined) return undefined;
  const written = valueOf(only);
  if (!Number.isFinite(written)) return undefined;
  return { amount: written, written, unit: unitKey(text, { start: only.index, end: only.index + only[0].length }, words.unitForms) };
};

const isUnscaled = (text: string, unscaled: readonly string[]): boolean => {
  const lower = text.normalize("NFKC").toLowerCase();
  return unscaled.some((word) => word !== "" && lower.includes(word.normalize("NFKC").toLowerCase()));
};

type Column = { readonly index: number; readonly servings: number; readonly heading: string };

type Row = { readonly item: Cell; readonly cells: readonly Cell[] };

/** The rows of one table whose item is named, as cells. */
const rowsOf = (rows: readonly Line[]): Row[] =>
  rows.flatMap((line) => {
    const cells = cellsOf(line);
    const [item] = cells;
    return item === undefined || withoutEdgeMarks(item.text) === "" ? [] : [{ item, cells }];
  });

type Pair = {
  readonly row: Row;
  readonly baseCell: Cell;
  readonly cell: Cell;
  readonly from: Amount;
  readonly to: Amount;
  readonly scales: boolean;
};

/** Each row's two cells, when both are amounts in one unit and the row is not left to the cook. */
const readablePairs = (rows: readonly Row[], base: Column, other: Column, words: ScaleWords): Pair[] =>
  rows.flatMap((row): Pair[] => {
    const [baseCell, cell] = [row.cells[base.index], row.cells[other.index]];
    if (baseCell === undefined || cell === undefined) return [];
    if (isUnscaled(baseCell.text, words.unscaled) || isUnscaled(cell.text, words.unscaled)) return [];
    const [from, to] = [amountOf(baseCell.text, words), amountOf(cell.text, words)];
    if (from === undefined || to === undefined || from.unit !== to.unit) return [];
    const scaled = (from.amount * other.servings) / base.servings;
    return [{ row, baseCell, cell, from, to, scales: Math.abs(to.amount - scaled) <= SAME * Math.max(Math.abs(scaled), 1) }];
  });

type Departure = { readonly pair: Pair; readonly scaled: number };

/** The one row of a column that departs from the base column while at least MIN_SCALED_ROWS others scale exactly. */
const departureOf = (rows: readonly Row[], base: Column, other: Column, words: ScaleWords): Departure | undefined => {
  const pairs = readablePairs(rows, base, other, words);
  const departing = pairs.filter((pair) => !pair.scales);
  const [only] = departing;
  const scaled = pairs.length - departing.length;
  return departing.length === 1 && only !== undefined && scaled >= MIN_SCALED_ROWS ? { pair: only, scaled } : undefined;
};

/** What `amount` would be if it were `ratio` times `from`, in the unit `amount` is written in. */
export const expectedOf = (from: Amount, amount: Amount, ratio: number): number => {
  const perWritten = amount.written === 0 || amount.amount === 0 ? 1 : amount.amount / amount.written;
  return (from.amount * ratio) / perWritten;
};

const columnSlip = (base: Column, other: Column, { pair, scaled }: Departure): ScaleSlip => ({
  item: pair.row.item,
  cell: pair.cell,
  heading: other.heading,
  other: pair.baseCell,
  otherHeading: base.heading,
  expected: expectedOf(pair.from, pair.to, other.servings / base.servings),
  scaledRows: scaled,
});

const baseSlip = (base: Column, other: Column, { pair, scaled }: Departure): ScaleSlip => ({
  item: pair.row.item,
  cell: pair.baseCell,
  heading: base.heading,
  other: pair.cell,
  otherHeading: other.heading,
  expected: expectedOf(pair.to, pair.from, base.servings / other.servings),
  scaledRows: scaled,
});

type Found = { readonly other: Column; readonly departure: Departure | undefined };

/** Whether the row's cells outside the first column scale with each other (a row fixed in every column does not). */
const othersAgree = (found: readonly Found[]): boolean => {
  const perServing = found.map(({ other, departure }) => (departure === undefined ? Number.NaN : departure.pair.to.amount / other.servings));
  const [first] = perServing;
  return first !== undefined && perServing.every((value) => Math.abs(value - first) <= SAME * Math.max(Math.abs(first), 1));
};

/**
 * One table's slips. Each column is compared with the first servings column. When the same row departs in every other column
 * (three or more columns) and those columns scale with each other, it is the first column's cell that is off, and that cell is
 * reported once; a row that departs everywhere without that (the same amount in every column) may be fixed on purpose.
 */
const tableSlips = (columns: readonly Column[], rows: readonly Row[], words: ScaleWords): ScaleSlip[] => {
  const [base, ...others] = columns;
  if (base === undefined) return [];
  const found: Found[] = others.map((other) => ({ other, departure: departureOf(rows, base, other, words) }));
  const [first] = found;
  const offRows = new Set(found.map(({ departure }) => departure?.pair.row));
  if (others.length > 1 && offRows.size === 1 && first?.departure !== undefined) {
    return othersAgree(found) ? [baseSlip(base, first.other, first.departure)] : [];
  }
  return found.flatMap(({ other, departure }) => (departure === undefined ? [] : [columnSlip(base, other, departure)]));
};

const columnsOf = (header: Line, marks: readonly Mark[]): Column[] =>
  cellsOf(header).flatMap((cell, index): Column[] => {
    const servings = index === 0 ? undefined : servingsOf(cell.text, marks);
    return servings === undefined ? [] : [{ index, servings, heading: withoutEdgeMarks(cell.text.trim()) }];
  });

/** Every table of the source with two or more servings columns, and the cells in them that do not scale. */
export const scaleSlips = (source: string, words: ScaleWords): ScaleSlip[] =>
  tablesOf(linesOf(source)).flatMap((table) => {
    const columns = columnsOf(table.header, words.columns);
    const distinct = new Set(columns.map((column) => column.servings));
    return distinct.size === columns.length && columns.length >= MIN_COLUMNS ? tableSlips(columns, rowsOf(table.rows), words) : [];
  });
