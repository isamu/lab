// bmi-mismatch: the reading half. Reads, section by section, the tables (each row's label and cells) and the "label: value"
// lines, and leaves the deciding to structure/bmi.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { tablesOf } from "../facts/table-facts.ts";
import { EDGE_MARKS, trimEndOf, withoutEdgeMarks } from "../facts/trim-marks.ts";
import { tableRowOf } from "./ratio-mismatch.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";
import { sectionBmiMismatches, type BodyKind, type BodyUnit, type BodyWords } from "../structure/bmi.ts";
import type { TableRow } from "../structure/ratio.ts";

const RULE = "bmi-mismatch";
const KINDS: ReadonlySet<string> = new Set(["height", "weight", "bmi"]);

const isKind = (group: string | undefined): group is BodyKind => group !== undefined && KINDS.has(group);

const unitsOf = (doc: ProseDocument, id: string): BodyUnit[] =>
  (doc.lexicons[id] ?? []).flatMap((entry) => (entry.weight === undefined ? [] : [{ pattern: entry.pattern, factor: entry.weight }]));

const wordsOf = (doc: ProseDocument): BodyWords => ({
  terms: (doc.lexicons["bmi-term"] ?? []).flatMap((entry) => (isKind(entry.group) ? [{ pattern: entry.pattern, kind: entry.group }] : [])),
  lengthUnits: unitsOf(doc, "unit-length"),
  massUnits: unitsOf(doc, "unit-mass"),
  bmiUnits: (doc.lexicons["bmi-unit"] ?? []).map((entry) => entry.pattern),
});

/** A list mark or a blockquote mark at the head of a line ("- ", "1. ", "> "). */
const LINE_MARK = /^\s*(?:>\s*)*(?:(?:[-*+]|\d+[.)])\s+)?/u;
/** "Height: 178 cm", 「身長：160.0 cm」: the label ends at the first colon. */
const COLON = /[:：]/u;
/** What may end a value: a sentence end, edge marks and spaces. */
const VALUE_END: ReadonlySet<string> = new Set([...EDGE_MARKS, "。", "."]);

/** A "label: value" line read as a row of one cell: the label up to the first colon, the value after it to the line end. */
const labelLineRow = (line: Line): TableRow[] => {
  const mark = LINE_MARK.exec(line.text)?.[0] ?? "";
  const colon = line.text.slice(mark.length).search(COLON);
  if (colon <= 0) return [];
  const valueFrom = mark.length + colon + 1;
  const text = withoutEdgeMarks(trimEndOf(line.text.slice(valueFrom), VALUE_END));
  if (text === "") return [];
  const start = line.start + valueFrom + line.text.slice(valueFrom).indexOf(text);
  return [{ label: withoutEdgeMarks(line.text.slice(mark.length, mark.length + colon)), cells: [{ start, text }] }];
};

type SectionGroups = { readonly tables: TableRow[][]; readonly lines: TableRow[] };

const sectionAt = (doc: ProseDocument, offset: number): number => doc.sections.findLastIndex((section) => section.span.start <= offset);

/** Each section's tables and its "label: value" lines, by the index of the section (-1 before the first). */
const groupsBySection = (doc: ProseDocument): Map<number, SectionGroups> => {
  const lines = linesOf(proseAndTablesOf(doc));
  const tables = tablesOf(lines);
  const tableLines = new Set(tables.flatMap((table) => [table.header.number, ...table.rows.map((row) => row.number)]));
  const groups = new Map<number, SectionGroups>();
  const groupAt = (offset: number): SectionGroups => {
    const index = sectionAt(doc, offset);
    const found = groups.get(index) ?? { tables: [], lines: [] };
    groups.set(index, found);
    return found;
  };
  tables.forEach((table) => groupAt(table.header.start).tables.push(table.rows.flatMap(tableRowOf)));
  lines.filter((line) => !tableLines.has(line.number)).forEach((line) => groupAt(line.start).lines.push(...labelLineRow(line)));
  return groups;
};

export const bmiMismatch: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (words.terms.length === 0) return [];
  return [...groupsBySection(doc).values()]
    .flatMap((section) => sectionBmiMismatches([...section.tables, section.lines], words))
    .toSorted((left, right) => left.offset - right.offset)
    .map((issue) => ({
      rule: RULE,
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, issue.offset),
      values: { ...issue.values, offset: issue.offset },
    }));
};
