// net-amount-mismatch: the reading half. Reads each table (its header cells and the cells of its rows) and each section's
// lines that are a label and an amount (総支給額：117,380円), with the words of lexicon net-amount-label, and leaves the
// deciding to structure/net-amount.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";
import {
  documentNetMismatch,
  sectionAmounts,
  sectionNetMismatch,
  tableAmounts,
  tableNetMismatches,
  type DocumentLabels,
  type LabelledLine,
  type NetCell,
  type NetIssue,
  type NetWords,
} from "../structure/net-amount.ts";

const RULE = "net-amount-mismatch";
/** Lexicon: the names of a payslip read across the whole document when each is set out on its own (総支給額, 控除合計, 差引支給額). */
const DOCUMENT_LABEL = "net-amount-document-label";
const HEADING = /^#{1,6}[ \t]/u;
/** A line that is a label and an amount, after any list marker: "- 総支給額：117,380円", "Net pay: $1,396.41". */
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,3}[.)])?[ \t]*/u;
const COLON = /[:：]/u;
const MAX_LABEL = 40;

export const patternsOf = (doc: ProseDocument, id: string, group?: string): string[] =>
  (doc.lexicons[id] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): NetWords => ({
  labels: {
    gross: patternsOf(doc, "net-amount-label", "gross"),
    deduction: patternsOf(doc, "net-amount-label", "deduction"),
    "deduction-part": patternsOf(doc, "net-amount-label", "deduction-part"),
    net: patternsOf(doc, "net-amount-label", "net"),
    taxable: patternsOf(doc, "net-amount-label", "taxable"),
  },
  periods: (doc.lexicons["net-amount-period"] ?? []).filter((entry) => entry.position !== undefined),
  periodLabels: { gross: patternsOf(doc, "net-amount-period", "gross") },
  magnitudes: patternsOf(doc, "amount-multiplier"),
  percentUnits: patternsOf(doc, "percent-unit"),
});

export const plainCellsOf = (line: Line): NetCell[] =>
  cellsOf(line).map((cell) => {
    const text = withoutEdgeMarks(cell.text);
    return { start: cell.start + Math.max(0, cell.text.indexOf(text)), text };
  });

const tableIssues = (lines: readonly Line[], words: NetWords): NetIssue[] =>
  tablesOf(lines).flatMap((table) => tableNetMismatches(plainCellsOf(table.header), table.rows.map(plainCellsOf), words));

export const labelledLineOf = (line: Line): LabelledLine[] => {
  const colon = COLON.exec(line.text)?.index;
  if (colon === undefined) return [];
  const label = withoutEdgeMarks(line.text.slice(LIST_MARKER.exec(line.text)?.[0].length ?? 0, colon));
  const value = line.text.slice(colon + 1);
  const text = withoutEdgeMarks(value);
  if (label === "" || label.length > MAX_LABEL || text === "") return [];
  return [{ label, value: { start: line.start + colon + 1 + value.indexOf(text), text } }];
};

/** The lines of the text between headings (the headings are read in the source: the prose text blanks them). */
export const sectionsOf = (lines: readonly Line[], sourceLines: readonly Line[]): Line[][] =>
  lines.reduce<Line[][]>(
    (sections, line, index) => {
      if (HEADING.test(sourceLines[index]?.text ?? "")) return [...sections, []];
      sections.at(-1)?.push(line);
      return sections;
    },
    [[]],
  );

const sectionLabelledLines = (lines: readonly Line[], source: string): LabelledLine[][] =>
  sectionsOf(lines, linesOf(source)).map((section) => section.filter((line) => !line.text.includes("|")).flatMap(labelledLineOf));

const sectionIssues = (lines: readonly Line[], source: string, words: NetWords): NetIssue[] =>
  sectionLabelledLines(lines, source).flatMap((section) => {
    const issue = sectionNetMismatch(section, words);
    return issue === undefined ? [] : [issue];
  });

const documentLabelsOf = (doc: ProseDocument): DocumentLabels => ({
  gross: patternsOf(doc, DOCUMENT_LABEL, "gross"),
  deduction: patternsOf(doc, DOCUMENT_LABEL, "deduction"),
  net: patternsOf(doc, DOCUMENT_LABEL, "net"),
});

/** The three names of a payslip set out in sections or tables of their own, read across the whole document. */
const documentIssues = (doc: ProseDocument, lines: readonly Line[], words: NetWords): NetIssue[] => {
  const tables = tablesOf(lines).map((table) => [plainCellsOf(table.header), ...table.rows.map(plainCellsOf)]);
  const sections = sectionLabelledLines(lines, doc.source);
  const amounts = [
    ...tables.flatMap(([header = [], ...rows]) => tableAmounts(header, rows, words)),
    ...sections.flatMap((section) => sectionAmounts(section, words)),
  ];
  const labelTexts = [...tables.flat(2).map((cell) => cell.text), ...sections.flat().map((line) => line.label)];
  const issue = documentNetMismatch(amounts, labelTexts, documentLabelsOf(doc), words);
  return issue === undefined ? [] : [issue];
};

export const netAmountMismatch: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (words.labels.gross.length === 0 || words.labels.deduction.length + words.labels["deduction-part"].length === 0) return [];
  const lines = linesOf(proseAndTablesOf(doc));
  const issues = [...tableIssues(lines, words), ...sectionIssues(lines, doc.source, words), ...documentIssues(doc, lines, words)];
  return issues
    .filter((issue, index) => issues.findIndex((other) => other.offset === issue.offset) === index)
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
