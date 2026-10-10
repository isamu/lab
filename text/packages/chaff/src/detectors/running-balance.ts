// running-balance-mismatch: the reading half. Reads the document's Markdown tables and the lexicons balance-column and
// total-label, and leaves the deciding to structure/running-balance.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { runningBalanceMismatches, type BalanceRole, type BalanceWord } from "../structure/running-balance.ts";

const RULE = "running-balance-mismatch";
const ROLES: readonly string[] = ["date", "sequence", "balance", "interest", "principal", "in", "out", "payment"] satisfies readonly BalanceRole[];
const isRole = (group: string | undefined): group is BalanceRole => group !== undefined && ROLES.includes(group);

/** Lexicon balance-column: the heading words that say which column holds the balance and which the movement of a row. */
const columnWordsOf = (doc: ProseDocument): BalanceWord[] =>
  (doc.lexicons["balance-column"] ?? []).flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : []));

export const runningBalance: Detector = (doc): Finding[] => {
  const columns = columnWordsOf(doc);
  if (columns.length === 0) return [];
  const tables = tablesOf(linesOf(proseAndTablesOf(doc))).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) }));
  const totalLabels = (doc.lexicons["total-label"] ?? []).map((entry) => entry.pattern);
  return runningBalanceMismatches(tables, { columns, totalLabels }).map((issue) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
