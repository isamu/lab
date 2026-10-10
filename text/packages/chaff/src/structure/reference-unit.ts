import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { escapeRegExp } from "../orthography.ts";
import { labColumnsOf, type LabColumn, type LabColumnWord } from "./lab-columns.ts";

/**
 * 検査結果の表で、結果の単位と基準値の単位が違う行（64 mmol/L と 40〜96 mg/dL）。結果・基準値・単位の列は見出しの語
 * （lab-result-column と reference-unit-column）で見つけ、単位は語彙表 reference-unit で読む。group が同じ単位
 * （mg/dL と mg/dl、×10⁴/µL と 万/µL）は同じ単位。升に単位が無ければ、列の見出しの単位、次にその行の単位の列を使う。どちらかの単位が読めなければ比べない。Pure.
 */
export type UnitWord = { readonly pattern: string; readonly unit: string };
type ColumnRole = Exclude<LabColumn, "flag">;
export type ReferenceUnitWords = { readonly units: readonly UnitWord[]; readonly columns: readonly LabColumnWord[] };

type UnitsIn = (text: string) => ReadonlySet<string>;
type Column = { readonly index: number; readonly role: ColumnRole; readonly units: ReadonlySet<string> };

const NO_UNITS: ReadonlySet<string> = new Set();
const DIGIT = /\d/u;
const BRACKET_OPEN = /[([]/u;
const SPACES = /\s+/gu;

const fold = (text: string): string => text.normalize("NFKC").toLowerCase();

/** A unit written as a count per volume ("/µL") is not read right after a scale it does not include ("× 10⁴/µL" is not "/µL"). */
const AFTER_SCALE = "(?<![×x]\\s*10\\^?\\d*\\s*)";

const alternationOf = (patterns: readonly string[]): string => patterns.map(escapeRegExp).join("|");

/** The units written in a text, by their group, never inside a longer word or unit ("mol/L" is not in "mmol/L", "mg" not in "mg/kg"). */
export const unitMatcher = (units: readonly UnitWord[]): UnitsIn => {
  const unitOf = new Map(units.map((word) => [fold(word.pattern), word.unit]));
  if (unitOf.size === 0) return () => NO_UNITS;
  const patterns = [...unitOf.keys()];
  const perVolume = alternationOf(patterns.filter((pattern) => pattern.startsWith("/")));
  const others = alternationOf(patterns.filter((pattern) => !pattern.startsWith("/")));
  const alternation = [others, perVolume === "" ? "" : `${AFTER_SCALE}(?:${perVolume})`].filter((part) => part !== "").join("|");
  const pattern = new RegExp(`(?<!\\p{L})(?:${alternation})(?![\\p{L}\\d/])`, "gu");
  return (text) => new Set([...fold(text).matchAll(pattern)].map((match) => unitOf.get(match[0]) ?? match[0]));
};

/** Two units are said to disagree only when both are known and the two share none (a cell may give a conversion too). */
export const unitsDisagree = (result: ReadonlySet<string>, range: ReadonlySet<string>): boolean =>
  result.size > 0 && range.size > 0 && ![...result].some((unit) => range.has(unit));

/** A heading without what it says in brackets ("結果（mg/dL）" is 結果, "Reference range (adult)" is reference range). */
const headingKey = (text: string): string => {
  const folded = fold(withoutEdgeMarks(text));
  const bracket = folded.search(BRACKET_OPEN);
  return (bracket === -1 ? folded : folded.slice(0, bracket)).replace(SPACES, " ").trim();
};

const columnsOf = (header: Line, words: ReferenceUnitWords, unitsIn: UnitsIn): Column[] => {
  const cells = cellsOf(header);
  const kinds = labColumnsOf(
    cells.map((cell) => cell.text),
    words.columns,
    headingKey,
  );
  return cells.flatMap((cell, index) => {
    const role = kinds[index];
    return role === undefined || role === "flag" ? [] : [{ index, role, units: unitsIn(cell.text) }];
  });
};

/** A cell's units: its own, else its column heading's, else the row's unit column. None when the cell holds no number. */
const unitsOfCell = (cell: Cell | undefined, fallbacks: readonly ReadonlySet<string>[], unitsIn: UnitsIn): ReadonlySet<string> => {
  if (cell === undefined || !DIGIT.test(fold(cell.text))) return NO_UNITS;
  const own = unitsIn(cell.text);
  return own.size > 0 ? own : (fallbacks.find((units) => units.size > 0) ?? NO_UNITS);
};

const issueAt = (cell: Cell, item: string, range: Cell): StructureIssue => ({
  offset: cell.start + (cell.text.length - cell.text.trimStart().length),
  values: { item, result: withoutEdgeMarks(cell.text), range: withoutEdgeMarks(range.text) },
});

/** Each result cell against each reference range cell (two ranges, for men and women, are two comparisons); one issue a result. */
const rowIssues = (row: Line, columns: readonly Column[], unitsIn: UnitsIn): StructureIssue[] => {
  const cells = cellsOf(row);
  const unitColumn = columns.find((column) => column.role === "unit");
  const rowUnits = unitColumn === undefined ? NO_UNITS : unitsIn(cells[unitColumn.index]?.text ?? "");
  const unitsAt = (column: Column): ReadonlySet<string> => unitsOfCell(cells[column.index], [column.units, rowUnits], unitsIn);
  const ranges = columns.filter((column) => column.role === "range");
  const item = withoutEdgeMarks(cells[0]?.text ?? "");
  return columns.flatMap((column) => {
    const cell = cells[column.index];
    if (column.role !== "result" || cell === undefined) return [];
    const range = ranges.find((candidate) => unitsDisagree(unitsAt(column), unitsAt(candidate)));
    const rangeCell = range === undefined ? undefined : cells[range.index];
    return rangeCell === undefined ? [] : [issueAt(cell, item, rangeCell)];
  });
};

/** The rows of every result table whose result is in another unit than its reference range. */
export const referenceUnitMismatches = (source: string, words: ReferenceUnitWords): StructureIssue[] => {
  const unitsIn = unitMatcher(words.units);
  return tablesOf(linesOf(source)).flatMap((table) => {
    const columns = columnsOf(table.header, words, unitsIn);
    if (!columns.some((column) => column.role === "result") || !columns.some((column) => column.role === "range")) return [];
    return table.rows.flatMap((row) => rowIssues(row, columns, unitsIn));
  });
};
