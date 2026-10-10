import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { linesOf, type Line } from "./lines.ts";
import { withoutTrailingNote, type MeterEntry, type MeterGroup, type MeterKind, type MeterUnitWord } from "./meter-usage.ts";

/**
 * 検針票の名前の付いた値を、まとまりごとに集める。まとまりは見出しから次の見出しまで。値は三つの書き方から読む。
 * 「今回指示数：12,640」の行、行の見出しが名前の表（| 今回指示数 | 12,640 |）、列の見出しが名前の表
 * （| 今回指示数 | 前回指示数 | ご使用量 |）。列の見出しが名前の表で本体が二行以上なら、行ごとに別のメーターとして一つの
 * まとまりにする。名前は語彙表 meter-reading-label から、列の見出しの単位は meter-unit から来る。Pure.
 */
export type MeterLabel = { readonly pattern: string; readonly kind: MeterKind };

export type MeterReadWords = { readonly labels: readonly MeterLabel[]; readonly units: readonly MeterUnitWord[] };

const LIST_MARK = /^[-*+]\s/u;
const DIGIT = /\d/u;

const keyOf = (text: string): string => withoutEdgeMarks(text).normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

const kindOf = (label: string, words: MeterReadWords): MeterKind | undefined => {
  const key = withoutTrailingNote(keyOf(label));
  return words.labels.find((word) => keyOf(word.pattern) === key)?.kind;
};

/** The unit a column heading names: the heading itself ("kWh") or its bracket ("指示数（kWh）"). */
const headerUnitOf = (heading: string, words: MeterReadWords): string | undefined => {
  const key = keyOf(heading);
  const bracket = withoutTrailingNote(key);
  const named = bracket === key ? key : key.slice(bracket.length).trim().slice(1, -1).trim();
  return words.units.find((unit) => keyOf(unit.pattern) === named)?.unit;
};

/** "- 今回指示数：12,640" → the label and the value with where the value starts in the line; undefined without a colon. */
const labelAndValue = (text: string): { label: string; value: string; at: number } | undefined => {
  const colon = [text.indexOf(":"), text.indexOf("：")].filter((index) => index > 0).reduce((first, index) => Math.min(first, index), Infinity);
  if (colon === Infinity) return undefined;
  const label = text.slice(0, colon).trim().replace(LIST_MARK, "");
  const rest = text.slice(colon + 1);
  const value = rest.trim();
  return value === "" ? undefined : { label, value, at: colon + 1 + rest.indexOf(value) };
};

const valueStart = (cell: Cell): number => cell.start + (cell.text.length - cell.text.trimStart().length);

const entryOf = (kind: MeterKind, cell: Cell, headerUnit: string | undefined): MeterEntry => ({
  kind,
  value: cell.text.trim(),
  offset: valueStart(cell),
  ...(headerUnit === undefined ? {} : { headerUnit }),
});

/** | 今回指示数 | 12,640 |: the row's one cell with a figure in it is the value. */
const rowEntry = (row: Line, headings: readonly string[], words: MeterReadWords): MeterEntry[] => {
  const [label, ...rest] = cellsOf(row);
  const kind = label === undefined ? undefined : kindOf(label.text, words);
  if (kind === undefined) return [];
  const withFigure = rest.flatMap((cell, index) => (DIGIT.test(cell.text) ? [{ cell, heading: headings[index + 1] ?? "" }] : []));
  const [only, ...more] = withFigure;
  if (only === undefined || more.length > 0) return [];
  return [entryOf(kind, only.cell, headerUnitOf(only.heading, words))];
};

/** | 今回指示数 | 前回指示数 | ご使用量 | over one row of values: each named column gives the value under it. */
const columnEntries = (row: Line, headings: readonly string[], words: MeterReadWords): MeterEntry[] =>
  cellsOf(row).flatMap((cell, index) => {
    const kind = kindOf(headings[index] ?? "", words);
    return kind === undefined ? [] : [entryOf(kind, cell, headerUnitOf(headings[index] ?? "", words))];
  });

type Placed = { readonly line: number; readonly entries: readonly MeterEntry[]; readonly alone: boolean };

const MIN_NAMED_COLUMNS = 2;

const tableEntries = (table: { header: Line; rows: Line[] }, words: MeterReadWords): Placed[] => {
  const headings = cellsOf(table.header).map((cell) => cell.text);
  const named = headings.filter((heading) => kindOf(heading, words) !== undefined).length;
  if (named >= MIN_NAMED_COLUMNS) {
    const alone = table.rows.length > 1;
    return table.rows.map((row) => ({ line: row.number, entries: columnEntries(row, headings, words), alone }));
  }
  return table.rows.map((row) => ({ line: row.number, entries: rowEntry(row, headings, words), alone: false }));
};

const lineEntry = (line: Line, words: MeterReadWords): Placed[] => {
  if (line.text.includes("|")) return [];
  const parts = labelAndValue(line.text);
  const kind = parts === undefined ? undefined : kindOf(parts.label, words);
  if (parts === undefined || kind === undefined) return [];
  return [{ line: line.number, entries: [{ kind, value: parts.value, offset: line.start + parts.at }], alone: false }];
};

/** Each line's section: how many headings start at or before it. Index 0 is unused (lines count from 1). */
const sectionsOf = (lines: readonly Line[], headingLines: readonly number[]): number[] => {
  const headings = new Set(headingLines);
  const sections = [0];
  lines.forEach((line) => sections.push((sections.at(-1) ?? 0) + (headings.has(line.number) ? 1 : 0)));
  return sections;
};

/**
 * The groups of a document. text is the prose with its tables (headings blanked, offsets kept); headingLines are the line
 * numbers of its headings, which split it into sections.
 */
export const meterGroups = (text: string, headingLines: readonly number[], words: MeterReadWords): MeterGroup[] => {
  const lines = linesOf(text);
  const tables = tablesOf(lines);
  const inTable = new Set(tables.flatMap((table) => [table.header.number, ...table.rows.map((row) => row.number)]));
  const placed = [
    ...tables.flatMap((table) => tableEntries(table, words)),
    ...lines.filter((line) => !inTable.has(line.number)).flatMap((line) => lineEntry(line, words)),
  ].filter((entry) => entry.entries.length > 0);
  if (placed.length === 0) return [];
  const sections = sectionsOf(lines, headingLines);
  const sectionOf = (line: number): number => sections[line] ?? 0;
  const sectionText = (section: number): string =>
    lines
      .filter((line) => sectionOf(line.number) === section)
      .map((line) => line.text)
      .join("\n");
  const alone = placed.filter((entry) => entry.alone).map((entry) => ({ entries: entry.entries, text: sectionText(sectionOf(entry.line)) }));
  const shared = [...new Set(placed.filter((entry) => !entry.alone).map((entry) => sectionOf(entry.line)))].map((section) => ({
    entries: placed
      .filter((entry) => !entry.alone && sectionOf(entry.line) === section)
      .toSorted((left, right) => left.line - right.line)
      .flatMap((entry) => entry.entries),
    text: sectionText(section),
  }));
  return [...shared, ...alone];
};
