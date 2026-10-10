import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { linesOf, type Line } from "./lines.ts";

/**
 * A results table that mixes scales without saying so: a cell written in another scale unit than the table's (110,000千円 among
 * 百万円), or, under a stated unit, one row entered a thousand times too large (52,000 among 1,200 and 84 under 単位：百万円).
 * The scale units, the caption marks and the total labels come from the language packages. Pure.
 */
export type ScaleUnit = { readonly word: string; readonly value: number };

export type TableScaleWords = {
  /** Words of scale written in a cell or a caption (百万円, million, millions), with the number they multiply by. */
  readonly units: readonly ScaleUnit[];
  /** What marks a line as a table's caption of unit (単位, in, of). */
  readonly captionMarks: readonly string[];
  /** Row labels of a total (合計, Total): a total row is large by nature. */
  readonly totalLabels: readonly string[];
};

export type TableScaleSlip = {
  /** "unit": the cell is written in another scale unit; "row": the row is a thousand times its neighbours. */
  readonly kind: "unit" | "row";
  readonly item: string;
  readonly cell: Cell;
  /** The table's scale as written: the caption's word, or the word most cells carry. */
  readonly tableUnit: string;
  /** For "row": the row's first figure divided by the factor, as it would read in the table's unit. */
  readonly reading?: number | undefined;
};

/** A cell read as one number with, at most, a scale unit after it. */
export type ScaleCell = { readonly number: number; readonly digits: string; readonly unit: ScaleUnit | undefined };

/** A row a thousand times its neighbours: the factor between thousands and millions, or millions and billions. */
export const ROW_FACTOR = 1000;
/** The row's figure must be at least this many times the largest of the other rows in its column. */
const LARGER_THAN_OTHERS = 10;
/** A row is compared on at least this many columns, and with at least this many other rows. */
const MIN_COLUMNS = 2;
const MIN_OTHER_ROWS = 2;
/** A caption of unit is a short line; a longer one is a sentence about the figures. */
const MAX_CAPTION_LENGTH = 40;
/** How many blank lines may stand between the caption and the table. */
const CAPTION_REACH = 2;

const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;
/** Currency marks and minus signs written before the figure ($, ¥, △52, -$52). */
const LEAD = /^(?:US\$|[$¥€£\-−△▲\s])+/u;
const NEGATIVE = /[-−△▲]/u;
const DIGITS = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/u;
/** An accounting negative: the figure in brackets, (52,000). */
const BRACKETED = /^[(（]([^()（）]+)[)）]$/u;
const CURRENCY_TAIL = /^[\p{L} ]*$/u;

const boundaryAt = (text: string, index: number): boolean => {
  const char = text[index];
  return char === undefined || !LETTER.test(char);
};

/** The longest unit written at index, when it is a whole word (a Latin word must not run on: million in millions is not). */
const unitAt = (text: string, index: number, units: readonly ScaleUnit[]): ScaleUnit | undefined => {
  const lower = text.toLowerCase();
  return units
    .filter((unit) => lower.startsWith(unit.word.toLowerCase(), index))
    .filter((unit) => !LATIN.test(unit.word) || (boundaryAt(text, index - 1) && boundaryAt(text, index + unit.word.length)))
    .toSorted((left, right) => right.word.length - left.word.length)[0];
};

/** Every unit written in the text, longest first at each place, without overlaps (百万円 is not also 万円). */
export const unitsIn = (text: string, units: readonly ScaleUnit[]): ScaleUnit[] => {
  const found: ScaleUnit[] = [];
  const step = (index: number): void => {
    if (index >= text.length) return;
    const unit = unitAt(text, index, units);
    if (unit !== undefined) found.push(unit);
    step(index + (unit?.word.length ?? 1));
  };
  step(0);
  return found;
};

/** The unit after a figure, with nothing after it but a currency word (円, US dollars); null when there is no unit. */
const unitAfter = (rest: string, units: readonly ScaleUnit[]): ScaleUnit | null | undefined => {
  if (rest === "") return null;
  const unit = unitAt(rest, 0, units);
  return unit !== undefined && CURRENCY_TAIL.test(rest.slice(unit.word.length)) ? unit : undefined;
};

const negated = (cell: ScaleCell | undefined): ScaleCell | undefined => (cell === undefined || cell.number < 0 ? undefined : { ...cell, number: -cell.number });

/** A cell's number and its scale unit; undefined when the cell is not one figure (7.0%, 1,200人, —). */
export const scaleCellOf = (text: string, units: readonly ScaleUnit[]): ScaleCell | undefined => {
  const plain = withoutEdgeMarks(text.trim());
  const bracketed = BRACKETED.exec(plain)?.[1];
  if (bracketed !== undefined) return negated(scaleCellOf(bracketed, units));
  const lead = LEAD.exec(plain)?.[0] ?? "";
  const digits = DIGITS.exec(plain.slice(lead.length))?.[0];
  if (digits === undefined) return undefined;
  const unit = unitAfter(plain.slice(lead.length + digits.length).trim(), units);
  if (unit === undefined) return undefined;
  const number = Number(digits.replaceAll(",", "")) * (NEGATIVE.test(lead) ? -1 : 1);
  return { number, digits, unit: unit ?? undefined };
};

const hasMark = (text: string, mark: string): boolean => {
  const lower = text.toLowerCase();
  const word = mark.toLowerCase();
  const at = lower.indexOf(word);
  if (at === -1) return false;
  return !LATIN.test(mark) || (boundaryAt(text, at - 1) && boundaryAt(text, at + word.length)) || hasMark(text.slice(at + word.length), mark);
};

/** The unit a line states for the table under it: a short line with no figure, a caption mark and one scale unit. */
export const captionUnitOf = (text: string, words: TableScaleWords): ScaleUnit | undefined => {
  const line = text.trim();
  if (line.length === 0 || line.length > MAX_CAPTION_LENGTH || DIGIT.test(line) || line.startsWith("|")) return undefined;
  if (!words.captionMarks.some((mark) => hasMark(line, mark))) return undefined;
  const found = unitsIn(line, words.units);
  const values = new Set(found.map((unit) => unit.value));
  return values.size === 1 ? found[0] : undefined;
};

const captionOf = (lines: readonly Line[], header: Line, words: TableScaleWords): ScaleUnit | undefined => {
  const index = lines.indexOf(header);
  const before = lines.slice(Math.max(0, index - CAPTION_REACH - 1), index).toReversed();
  const caption = before.find((line) => line.text.trim() !== "");
  return caption === undefined ? undefined : captionUnitOf(caption.text, words);
};

type ReadCell = { readonly cell: Cell; readonly read: ScaleCell; readonly column: number };
type ReadRow = { readonly item: string; readonly cells: readonly ReadCell[] };

const rowsOf = (rows: readonly Line[], units: readonly ScaleUnit[]): ReadRow[] =>
  rows.map((row) => {
    const [first, ...rest] = cellsOf(row);
    const cells = rest.flatMap((cell, column): ReadCell[] => {
      const read = scaleCellOf(cell.text, units);
      return read === undefined ? [] : [{ cell, read, column }];
    });
    return { item: withoutEdgeMarks((first?.text ?? "").trim()), cells };
  });

/** The unit most cells carry, when at least two do and no other unit is as common. */
const usualUnitOf = (rows: readonly ReadRow[]): ScaleUnit | undefined => {
  const counts = new Map<number, { unit: ScaleUnit; count: number }>();
  rows.forEach((row) =>
    row.cells.forEach(({ read }) => {
      if (read.unit === undefined) return;
      const seen = counts.get(read.unit.value);
      counts.set(read.unit.value, { unit: seen?.unit ?? read.unit, count: (seen?.count ?? 0) + 1 });
    }),
  );
  const [top, second] = [...counts.values()].toSorted((left, right) => right.count - left.count);
  return top !== undefined && top.count >= MIN_OTHER_ROWS && (second === undefined || second.count < top.count) ? top.unit : undefined;
};

/**
 * Whether a cell's unit departs from the table's. Under a stated unit, any other unit does. Without one, only a smaller unit
 * with a figure of one table unit or more (110,000千円 among 百万円): a larger unit for a large figure ($2.4 billion among
 * $130 million) is a normal way of writing.
 */
const departs = (read: ScaleCell, table: ScaleUnit, stated: boolean): boolean => {
  if (read.unit === undefined || read.unit.value === table.value) return false;
  if (stated) return true;
  return read.unit.value < table.value && Math.abs(read.number) * read.unit.value >= table.value;
};

const unitSlips = (rows: readonly ReadRow[], table: ScaleUnit, stated: boolean): TableScaleSlip[] =>
  rows.flatMap((row) => {
    const odd = row.cells.find(({ read }) => departs(read, table, stated));
    return odd === undefined ? [] : [{ kind: "unit" as const, item: row.item, cell: odd.cell, tableUnit: table.word }];
  });

const isTotal = (item: string, labels: readonly string[]): boolean => labels.some((label) => item.toLowerCase().startsWith(label.toLowerCase()));

/** A row's figure that reads as entered in a unit a thousand times smaller: whole thousands, at least one thousand. */
const wholeThousands = (read: ScaleCell): boolean =>
  read.unit === undefined && !read.digits.includes(".") && Math.abs(read.number) >= ROW_FACTOR && read.number % ROW_FACTOR === 0;

type BareRow = { readonly row: ReadRow; readonly figures: ReadonlyMap<number, ReadCell> };

const bareRowsOf = (rows: readonly ReadRow[]): BareRow[] =>
  rows.map((row) => ({ row, figures: new Map(row.cells.filter((entry) => entry.read.unit === undefined).map((entry) => [entry.column, entry])) }));

/**
 * Whether one figure stands a thousand times above its column: at least ten times the largest other figure, and a thousandth
 * of it no larger than that figure, so it reads as one of them once divided.
 */
const standsAbove = (figure: ScaleCell, others: readonly number[]): boolean => {
  const largest = Math.max(...others.map((value) => Math.abs(value)));
  return others.length >= MIN_OTHER_ROWS && Math.abs(figure.number) >= LARGER_THAN_OTHERS * largest && Math.abs(figure.number) / ROW_FACTOR <= largest;
};

const rowStandsAbove = (candidate: BareRow, rows: readonly BareRow[]): boolean => {
  const figures = [...candidate.figures.entries()];
  return (
    figures.length >= MIN_COLUMNS &&
    figures.every(([column, figure]) => {
      const others = rows.flatMap((row) => {
        const other = row === candidate ? undefined : row.figures.get(column);
        return other === undefined ? [] : [other.read.number];
      });
      return wholeThousands(figure.read) && standsAbove(figure.read, others);
    })
  );
};

/**
 * The one row, under a stated unit, entered a thousand times too large. Every figure of the row must be whole thousands (a row
 * multiplied by a thousand always is; a genuinely large row, such as total assets, almost never is in every column), stand ten
 * times above every other row of its column, and fall among them once divided. A total row and a row whose label carries its
 * own unit in brackets (従業員数（人）) are left alone, and so is a table where more than one row stands out (each in its own columns).
 */
const rowSlips = (rows: readonly ReadRow[], table: ScaleUnit, words: TableScaleWords): TableScaleSlip[] => {
  const bare = bareRowsOf(rows);
  const standing = bare.filter((row) => !isTotal(row.row.item, words.totalLabels) && !/[(（]/u.test(row.row.item) && rowStandsAbove(row, bare));
  const [only] = standing;
  if (only === undefined || standing.length > 1) return [];
  const first = [...only.figures.values()][0];
  return first === undefined ? [] : [{ kind: "row", item: only.row.item, cell: first.cell, tableUnit: table.word, reading: first.read.number / ROW_FACTOR }];
};

const tableSlips = (lines: readonly Line[], table: { header: Line; rows: Line[] }, words: TableScaleWords): TableScaleSlip[] => {
  const rows = rowsOf(table.rows, words.units);
  const caption = captionOf(lines, table.header, words);
  const unit = caption ?? usualUnitOf(rows);
  if (unit === undefined) return [];
  const units = unitSlips(rows, unit, caption !== undefined);
  return caption === undefined ? units : [...units, ...rowSlips(rows, caption, words)];
};

/** Every table of the text that mixes scales, and the cells or rows that depart. */
export const tableScaleSlips = (text: string, words: TableScaleWords): TableScaleSlip[] => {
  const lines = linesOf(text);
  return tablesOf(lines).flatMap((table) => tableSlips(lines, table, words));
};
