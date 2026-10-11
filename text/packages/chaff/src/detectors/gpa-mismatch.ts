// gpa-mismatch: the reading half. Reads the document's Markdown tables, its other lines, and the lexicons
// transcript-column, grade-point and gpa-label, and leaves the deciding to structure/gpa.ts.
import type { Detector, Finding, LexiconEntry, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { gpaMismatches, type GpaWords, type GradeWord, type TranscriptRole } from "../structure/gpa.ts";

const RULE = "gpa-mismatch";
const ROLES: readonly string[] = ["points", "grade", "credits", "course", "total"] satisfies readonly TranscriptRole[];
const isRole = (group: string | undefined): group is TranscriptRole => group !== undefined && ROLES.includes(group);
/** The grade-point group of grades that carry no points (認定, Pass). */
const NO_POINTS = "none";

const gradeWordOf = (entry: LexiconEntry): GradeWord[] => {
  if (entry.group === NO_POINTS) return [{ pattern: entry.pattern, scale: NO_POINTS }];
  return entry.group === undefined || entry.weight === undefined ? [] : [{ pattern: entry.pattern, scale: entry.group, points: entry.weight }];
};

const wordsOf = (doc: ProseDocument): GpaWords => ({
  columns: (doc.lexicons["transcript-column"] ?? []).flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : [])),
  grades: (doc.lexicons["grade-point"] ?? []).flatMap(gradeWordOf),
  labels: (doc.lexicons["gpa-label"] ?? []).map((entry) => ({ pattern: entry.pattern, part: entry.group === "part" })),
});

export const gpaMismatch: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (words.columns.length === 0 || words.grades.length === 0 || words.labels.length === 0) return [];
  const lines = linesOf(proseAndTablesOf(doc));
  const found = tablesOf(lines);
  const tableLines = new Set(found.flatMap((table) => [table.header.number, ...table.rows.map((row) => row.number)]));
  const tables = found.map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) }));
  const prose = lines.filter((line) => !tableLines.has(line.number));
  return gpaMismatches(tables, prose, words).map((issue) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
