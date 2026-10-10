// reference-flag-mismatch: a row of a lab or checkup results table whose flag (H, L, 高, 低, 基準内, Normal) says the opposite of
// where its value stands against the reference range on the same row. The column headings, the flags and the bound marks come
// from the lexicons (lab-result-column with reference-column-heading, reference-flag, range-band-word, reference-bound-mark). Pure.
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { labColumnsOf, type LabColumnWord } from "./lab-columns.ts";
import { linesOf, type Line } from "./lines.ts";
import { parseBand, type Band, type BandWords, type Bound } from "./range-bands.ts";

/** What a flag says: above the range, below it, inside it, or outside it on either side (基準外, *). */
export type FlagMeaning = "high" | "low" | "normal" | "outside";

export type ReferenceWords = {
  readonly headings: readonly LabColumnWord[];
  readonly flags: readonly { readonly pattern: string; readonly meaning: FlagMeaning }[];
  /** How a range is read: range-band-word with the reference marks (≤, >), and no units (the row's own unit is taken out first). */
  readonly band: BandWords;
};

export type Position = "below" | "inside" | "above";

/**
 * "inside": flagged high, low or outside although inside the range. "outside": flagged normal although outside it. "below": flagged
 * high although below the range; "above": flagged low although above it.
 */
export type FlagSlipKind = "inside" | "outside" | "below" | "above";

export type FlagSlip = {
  readonly kind: FlagSlipKind;
  readonly item: string;
  readonly value: string;
  readonly range: string;
  readonly flag: Cell;
};

/** A result cell: one number and what follows it (its unit, possibly nothing). */
export type ReadValue = { readonly number: number; readonly unit: string };

const DIGITS = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/u;
const STARTS_NUMERIC = /^[\d.,]/u;
/** A unit has no figure and no note: 1.2/1, 88 (fasting) and 3.5 x10^4/μL are not a number and its unit. */
const NOT_A_UNIT = /[\d()[\]]/u;
const NOTE_OPEN = /[([]/u;
/** A unit is a whole word when no Latin or Greek letter runs on from it: cm in 90 cm未満, not the l of less. */
const LETTER = /[\p{Script=Latin}\p{Script=Greek}]/u;
const SPACES = /\s+/gu;

const normalized = (text: string): string => withoutEdgeMarks(text.normalize("NFKC").toLowerCase().replace(SPACES, " ").trim());

/** The number of a result cell and the unit after it; undefined when the cell is not a plain number (<0.5, 陰性, —). */
export const valueOf = (text: string): ReadValue | undefined => {
  const plain = normalized(text);
  const digits = DIGITS.exec(plain)?.[0];
  if (digits === undefined) return undefined;
  const unit = plain.slice(digits.length).trim();
  if (STARTS_NUMERIC.test(unit) || NOT_A_UNIT.test(unit)) return undefined;
  return { number: Number(digits.replaceAll(",", "")), unit };
};

const isLetterAt = (text: string, index: number): boolean => LETTER.test(text.charAt(index));

/** The text with every whole occurrence of the unit blanked out: mg/dL in "30〜149 mg/dL", not the l of "less". */
const withoutUnit = (text: string, unit: string): string => {
  if (unit === "") return text;
  const at = text.indexOf(unit);
  if (at === -1) return text;
  const end = at + unit.length;
  const whole = !(LETTER.test(unit.charAt(0)) && isLetterAt(text, at - 1)) && !(LETTER.test(unit.charAt(unit.length - 1)) && isLetterAt(text, end));
  const head = text.slice(0, at) + (whole ? " " : unit);
  return head + withoutUnit(text.slice(end), unit);
};

/**
 * The reference range of a row, read once the row's unit is taken out: 30〜149 mg/dL, 79 U/L 以下, ≤79, below 102 cm. undefined
 * when anything else is left (another unit, a range for men and one for women, a note), so a row in two units is not read.
 */
export const rangeOf = (text: string, unit: string, words: ReferenceWords): Band | undefined => {
  const bare = withoutUnit(normalized(text), unit);
  return NOTE_OPEN.test(bare) ? undefined : parseBand(bare, words.band);
};

/** A heading without the unit in brackets at its end: Result (mg/dL), 結果（mg/dL）. */
const headingKeyOf = (heading: string): string => {
  const key = normalized(heading);
  const open = key.lastIndexOf("(");
  return key.endsWith(")") && open > 0 ? key.slice(0, open).trim() : key;
};

/** A flag compared as written: emphasis marks dropped, unless the flag is only such a mark (*). */
const flagKeyOf = (text: string): string => {
  const plain = normalized(text);
  return plain === "" ? text.normalize("NFKC").trim().toLowerCase() : plain;
};

/** What a flag cell says, by the flag lexicon; undefined for a flag chaff does not know (A, 要再検査, —). */
export const flagOf = (text: string, words: ReferenceWords): FlagMeaning | undefined => {
  const key = flagKeyOf(text);
  return key === "" ? undefined : words.flags.find((flag) => flagKeyOf(flag.pattern) === key)?.meaning;
};

/**
 * A two-sided range written with only a range mark (30〜149, 4.0–5.6) includes its ends: a reference interval names the lowest
 * and the highest value counted as within it, so 149 against 30〜149 is inside. 未満, 超, under and < leave their end out.
 */
const belowLow = (value: number, low: Bound | undefined): boolean => low !== undefined && (low.kind === "exclusive" ? value <= low.value : value < low.value);
const aboveHigh = (value: number, high: Bound | undefined): boolean =>
  high !== undefined && (high.kind === "exclusive" ? value >= high.value : value > high.value);

export const positionOf = (value: number, range: Band): Position => {
  if (belowLow(value, range.low)) return "below";
  return aboveHigh(value, range.high) ? "above" : "inside";
};

/** Whether a flag contradicts the value's place against its range, and how. */
export const slipKindOf = (flag: FlagMeaning, position: Position): FlagSlipKind | undefined => {
  if (position === "inside") return flag === "normal" ? undefined : "inside";
  if (flag === "normal") return "outside";
  if (flag === "high" && position === "below") return "below";
  return flag === "low" && position === "above" ? "above" : undefined;
};

type Columns = { readonly result: number; readonly range: number; readonly flag: number };

const COLUMNS = ["result", "range", "flag"] as const;

/** The column of each kind, by its heading; undefined unless each kind names exactly one column. */
export const columnsOf = (headings: readonly string[], words: ReferenceWords): Columns | undefined => {
  const kinds = labColumnsOf(headings, words.headings, headingKeyOf);
  const found = COLUMNS.map((column) => kinds.flatMap((kind, index) => (kind === column ? [index] : [])));
  const [result, range, flag] = found.map((indexes) => (indexes.length === 1 ? indexes[0] : undefined));
  return result === undefined || range === undefined || flag === undefined ? undefined : { result, range, flag };
};

const rowSlip = (row: Line, columns: Columns, words: ReferenceWords): FlagSlip[] => {
  const cells = cellsOf(row);
  const [valueCell, rangeCell, flagCell] = [cells[columns.result], cells[columns.range], cells[columns.flag]];
  if (valueCell === undefined || rangeCell === undefined || flagCell === undefined) return [];
  const flag = flagOf(flagCell.text, words);
  const value = valueOf(valueCell.text);
  const range = value === undefined ? undefined : rangeOf(rangeCell.text, value.unit, words);
  if (flag === undefined || value === undefined || range === undefined) return [];
  const kind = slipKindOf(flag, positionOf(value.number, range));
  if (kind === undefined) return [];
  const item = withoutEdgeMarks((cells[0]?.text ?? "").trim());
  return [{ kind, item, value: valueCell.text.trim(), range: rangeCell.text.trim(), flag: flagCell }];
};

/** Every row of every results table of the text whose flag contradicts its value and reference range. */
export const referenceFlagSlips = (text: string, words: ReferenceWords): FlagSlip[] =>
  tablesOf(linesOf(text)).flatMap((table) => {
    const columns = columnsOf(
      cellsOf(table.header).map((cell) => cell.text),
      words,
    );
    return columns === undefined ? [] : table.rows.flatMap((row) => rowSlip(row, columns, words));
  });
