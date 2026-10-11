// net-amount-mismatch: the reading half. Reads each table (its header cells and the cells of its rows) and each section's
// lines that are a label and an amount (総支給額：117,380円), with the words of lexicon net-amount-label, and leaves the
// deciding to structure/net-amount.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";
import { NET_ROLES, sectionNetMismatch, tableNetMismatches, type LabelledLine, type NetCell, type NetIssue, type NetWords } from "../structure/net-amount.ts";

const RULE = "net-amount-mismatch";
const HEADING = /^#{1,6}[ \t]/u;
/** A line that is a label and an amount, after any list marker: "- 総支給額：117,380円", "Net pay: $1,396.41". */
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,3}[.)])?[ \t]*/u;
const COLON = /[:：]/u;
const MAX_LABEL = 40;

const patternsOf = (doc: ProseDocument, id: string, group?: string): string[] =>
  (doc.lexicons[id] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): NetWords => ({
  labels: {
    gross: patternsOf(doc, "net-amount-label", "gross"),
    deduction: patternsOf(doc, "net-amount-label", "deduction"),
    net: patternsOf(doc, "net-amount-label", "net"),
  },
  magnitudes: patternsOf(doc, "amount-multiplier"),
  percentUnits: patternsOf(doc, "percent-unit"),
});

const plainCellsOf = (line: Line): NetCell[] =>
  cellsOf(line).map((cell) => {
    const text = withoutEdgeMarks(cell.text);
    return { start: cell.start + Math.max(0, cell.text.indexOf(text)), text };
  });

const tableIssues = (lines: readonly Line[], words: NetWords): NetIssue[] =>
  tablesOf(lines).flatMap((table) => tableNetMismatches(plainCellsOf(table.header), table.rows.map(plainCellsOf), words));

const labelledLineOf = (line: Line): LabelledLine[] => {
  const colon = COLON.exec(line.text)?.index;
  if (colon === undefined) return [];
  const label = withoutEdgeMarks(line.text.slice(LIST_MARKER.exec(line.text)?.[0].length ?? 0, colon));
  const value = line.text.slice(colon + 1);
  const text = withoutEdgeMarks(value);
  if (label === "" || label.length > MAX_LABEL || text === "") return [];
  return [{ label, value: { start: line.start + colon + 1 + value.indexOf(text), text } }];
};

/** The lines of the text between headings (the headings are read in the source: the prose text blanks them). */
const sectionsOf = (lines: readonly Line[], sourceLines: readonly Line[]): Line[][] =>
  lines.reduce<Line[][]>(
    (sections, line, index) => {
      if (HEADING.test(sourceLines[index]?.text ?? "")) return [...sections, []];
      sections.at(-1)?.push(line);
      return sections;
    },
    [[]],
  );

const sectionIssues = (lines: readonly Line[], source: string, words: NetWords): NetIssue[] =>
  sectionsOf(lines, linesOf(source)).flatMap((section) => {
    const issue = sectionNetMismatch(section.filter((line) => !line.text.includes("|")).flatMap(labelledLineOf), words);
    return issue === undefined ? [] : [issue];
  });

export const netAmountMismatch: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (NET_ROLES.some((role) => words.labels[role].length === 0)) return [];
  const lines = linesOf(proseAndTablesOf(doc));
  return [...tableIssues(lines, words), ...sectionIssues(lines, doc.source, words)]
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
