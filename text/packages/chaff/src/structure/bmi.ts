/**
 * bmi-mismatch: the deciding half. A BMI written next to the height and the weight of the same person, against the weight in
 * kilograms divided by the square of the height in metres. Which labels name the three, and which units a height or a weight
 * may be written in, is data (lexicons bmi-term, bmi-unit, unit-length, unit-mass). Pure.
 */
import { keyOf, labelKey, noteOf, readNumber, type TableCell, type TableRow } from "./ratio.ts";

export type BodyKind = "height" | "weight" | "bmi";

export type BodyTerm = { readonly pattern: string; readonly kind: BodyKind };

/** A unit and its factor to the base unit the lexicon counts in (metres for a length, grams for a mass). */
export type BodyUnit = { readonly pattern: string; readonly factor: number };

export type BodyWords = {
  readonly terms: readonly BodyTerm[];
  readonly lengthUnits: readonly BodyUnit[];
  readonly massUnits: readonly BodyUnit[];
  readonly bmiUnits: readonly string[];
};

/** A measure as written, in the base unit: its value and the half step of its last written digit. */
export type Measure = { readonly value: number; readonly half: number };

/** A BMI as written: where it starts, its value and the number of its decimals. */
export type WrittenBmi = { readonly start: number; readonly value: number; readonly decimals: number };

export type BmiIssue = { readonly offset: number; readonly values: Readonly<Record<string, string>> };

const HALF = 0.5;
const DECIMAL_BASE = 10;
const GRAMS_PER_KILOGRAM = 1000;
/** Floating error must not push a BMI that sits on the edge of its rounding out of it. */
const FLOAT_SLACK = 1e-9;

/**
 * The BMI the height and the weight give, when the written BMI cannot be it; undefined when it can. Every written figure
 * stands for the half step of its last digit around it (22.0 is 21.95 to 22.05, 178 cm is 177.5 to 178.5 cm), and the
 * BMI is compared with the whole range the height and weight can give: the lightest weight over the tallest height to the
 * heaviest weight over the shortest height.
 */
export const bmiDisagreement = (bmi: WrittenBmi, height: Measure, weight: Measure): string | undefined => {
  const shortest = height.value - height.half;
  if (shortest <= 0 || weight.value <= 0) return undefined;
  const lowest = Math.max(0, weight.value - weight.half) / (height.value + height.half) ** 2;
  const highest = (weight.value + weight.half) / shortest ** 2;
  const half = HALF * DECIMAL_BASE ** -bmi.decimals + FLOAT_SLACK;
  if (bmi.value + half >= lowest && bmi.value - half <= highest) return undefined;
  return (weight.value / height.value ** 2).toFixed(bmi.decimals);
};

const unitFactor = (unit: string, units: readonly BodyUnit[]): number | undefined => units.find((entry) => keyOf(entry.pattern) === keyOf(unit))?.factor;

/** The unit a row label notes in brackets (身長（cm）, Weight (kg)), without the brackets. */
const notedUnit = (label: string): string => noteOf(label).slice(1, -1);

/**
 * A cell read as a measure in the base unit: one plain number and a unit of the list after it, or nothing after it when the
 * row label notes the unit. Anything else (a range, 約, a second number, a unit not listed) is not read, nor is a row whose
 * label notes something other than a unit (Weight (last year)).
 */
export const cellMeasure = (text: string, label: string, units: readonly BodyUnit[]): Measure | undefined => {
  const cell = readNumber(text);
  const noted = notedUnit(label);
  if (cell === undefined || cell.prefix !== "" || (noted !== "" && unitFactor(noted, units) === undefined)) return undefined;
  const factor = unitFactor(cell.suffix === "" ? noted : cell.suffix, units);
  return factor === undefined ? undefined : { value: cell.value * factor, half: HALF * DECIMAL_BASE ** -cell.decimals * factor };
};

/** The text without a BMI unit at its end. The unit is cut off before the number is read, as its ² is a digit after NFKC. */
const withoutBmiUnit = (text: string, units: readonly string[]): string => {
  const plain = text.normalize("NFKC").trim();
  const unit = units.map((entry) => entry.normalize("NFKC")).find((entry) => plain.toLowerCase().endsWith(entry.toLowerCase()));
  return unit === undefined ? plain : plain.slice(0, -unit.length);
};

/**
 * A cell read as a BMI: one plain number, with nothing after it or a BMI unit (kg/m²). A row whose label notes something
 * other than a BMI unit (BMI (percentile)) is not read.
 */
export const cellBmi = (cell: TableCell, label: string, units: readonly string[]): WrittenBmi | undefined => {
  const noted = notedUnit(label);
  if (noted !== "" && withoutBmiUnit(noted, units) !== "") return undefined;
  const read = readNumber(withoutBmiUnit(cell.text, units));
  if (read === undefined || read.prefix !== "" || read.suffix !== "") return undefined;
  return { start: cell.start, value: read.value, decimals: read.decimals };
};

const kindOf = (row: TableRow, terms: readonly BodyTerm[]): BodyKind | undefined => terms.find((term) => keyOf(term.pattern) === labelKey(row.label))?.kind;

/** The rows of one kind, from every group. */
const rowsOfKind = (groups: readonly (readonly TableRow[])[], terms: readonly BodyTerm[], kind: BodyKind): { group: number; row: TableRow }[] =>
  groups.flatMap((rows, group) => rows.filter((row) => kindOf(row, terms) === kind).map((row) => ({ group, row })));

type Trio = { readonly height: TableRow; readonly weight: TableRow; readonly bmi: TableRow };

/** The one height, weight and BMI row of a section, all in the same group; undefined when any is missing or written twice. */
const trioOf = (groups: readonly (readonly TableRow[])[], terms: readonly BodyTerm[]): Trio | undefined => {
  const only = (kind: BodyKind): { group: number; row: TableRow } | undefined => {
    const found = rowsOfKind(groups, terms, kind);
    return found.length === 1 ? found[0] : undefined;
  };
  const [height, weight, bmi] = [only("height"), only("weight"), only("bmi")];
  if (height === undefined || weight === undefined || bmi === undefined) return undefined;
  if (height.group !== bmi.group || weight.group !== bmi.group) return undefined;
  return { height: height.row, weight: weight.row, bmi: bmi.row };
};

const sameWidth = (trio: Trio): boolean => trio.height.cells.length === trio.bmi.cells.length && trio.weight.cells.length === trio.bmi.cells.length;

const columnIssue = (trio: Trio, column: number, words: BodyWords): BmiIssue[] => {
  const [heightCell, weightCell, bmiCell] = [trio.height.cells[column], trio.weight.cells[column], trio.bmi.cells[column]];
  if (heightCell === undefined || weightCell === undefined || bmiCell === undefined) return [];
  const height = cellMeasure(heightCell.text, trio.height.label, words.lengthUnits);
  const mass = cellMeasure(weightCell.text, trio.weight.label, words.massUnits);
  const bmi = cellBmi(bmiCell, trio.bmi.label, words.bmiUnits);
  if (height === undefined || mass === undefined || bmi === undefined) return [];
  const weight = { value: mass.value / GRAMS_PER_KILOGRAM, half: mass.half / GRAMS_PER_KILOGRAM };
  const computed = bmiDisagreement(bmi, height, weight);
  return computed === undefined ? [] : [{ offset: bmi.start, values: { written: bmi.value.toFixed(bmi.decimals), computed } }];
};

/**
 * One section of a document is one person. Its groups are its tables and, as one more group, its "label: value" lines, each
 * read as a row of one cell. When the section has exactly one height, one weight and one BMI row, all in one group, the three
 * are compared column by column. Two heights or two weights (two people, or a before and an after) leave it unread, and so
 * does a table whose three rows have different numbers of cells (its columns may not line up).
 */
export const sectionBmiMismatches = (groups: readonly (readonly TableRow[])[], words: BodyWords): BmiIssue[] => {
  const trio = trioOf(groups, words.terms);
  if (trio === undefined || !sameWidth(trio)) return [];
  return trio.bmi.cells.flatMap((_, column) => columnIssue(trio, column, words));
};
