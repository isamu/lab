// closing-balance-mismatch: the reading half. Reads tables and each section's label-and-amount lines the way
// net-amount-mismatch does, with the words of lexicon closing-balance-label, and leaves the deciding to
// structure/closing-balance.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { tablesOf } from "../facts/table-facts.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";
import { labelledLineOf, patternsOf, plainCellsOf, sectionsOf } from "./net-amount-mismatch.ts";
import { BALANCE_ROLES, sectionClosingMismatch, tableClosingMismatches, type BalanceWords } from "../structure/closing-balance.ts";
import type { NetIssue } from "../structure/net-amount.ts";

const RULE = "closing-balance-mismatch";
const LEXICON = "closing-balance-label";

const wordsOf = (doc: ProseDocument): BalanceWords => ({
  labels: {
    opening: patternsOf(doc, LEXICON, "opening"),
    inflow: patternsOf(doc, LEXICON, "inflow"),
    outflow: patternsOf(doc, LEXICON, "outflow"),
    closing: patternsOf(doc, LEXICON, "closing"),
  },
  asOf: patternsOf(doc, LEXICON, "as-of"),
  magnitudes: patternsOf(doc, "amount-multiplier"),
  percentUnits: patternsOf(doc, "percent-unit"),
});

const tableIssues = (lines: readonly Line[], words: BalanceWords): NetIssue[] =>
  tablesOf(lines).flatMap((table) => tableClosingMismatches(plainCellsOf(table.header), table.rows.map(plainCellsOf), words));

const sectionIssues = (lines: readonly Line[], source: string, words: BalanceWords): NetIssue[] =>
  sectionsOf(lines, linesOf(source)).flatMap((section) => {
    const issue = sectionClosingMismatch(section.filter((line) => !line.text.includes("|")).flatMap(labelledLineOf), words);
    return issue === undefined ? [] : [issue];
  });

export const closingBalanceMismatch: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (BALANCE_ROLES.some((role) => words.labels[role].length === 0)) return [];
  const lines = linesOf(proseAndTablesOf(doc));
  const issues = [...tableIssues(lines, words), ...sectionIssues(lines, doc.source, words)];
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
