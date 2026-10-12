// variance-mismatch: the reading half. The heading words of the budget, actual and variance columns are lexicon
// variance-column, the words of magnitude amount-multiplier; the tables are read from the prose with its tables put back.
// The deciding is structure/variance-table.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { varianceMismatches, type VarianceRole, type VarianceWords } from "../structure/variance-table.ts";

const RULE = "variance-mismatch";
const ROLES: readonly string[] = ["rate", "variance", "budget", "actual"] satisfies readonly VarianceRole[];
const isRole = (group: string | undefined): group is VarianceRole => group !== undefined && ROLES.includes(group);

const wordsOf = (doc: ProseDocument): VarianceWords => ({
  columns: (doc.lexicons["variance-column"] ?? []).flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : [])),
  multipliers: (doc.lexicons["amount-multiplier"] ?? []).map((entry) => entry.pattern),
});

export const varianceMismatch: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (words.columns.length === 0) return [];
  const text = proseAndTablesOf(doc);
  const tables = tablesOf(linesOf(text)).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) }));
  return varianceMismatches(tables, words).map((issue) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
