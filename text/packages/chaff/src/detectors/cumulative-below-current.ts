// cumulative-below-current: the reading half. Reads the document's Markdown tables and the lexicon cumulative-table, and
// leaves the deciding to structure/cumulative-below-current.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { cumulativeBelowCurrent, type CumulativeRole, type CumulativeWord } from "../structure/cumulative-below-current.ts";

const RULE = "cumulative-below-current";
const ROLES: readonly string[] = ["current", "cumulative", "prior", "level"] satisfies readonly CumulativeRole[];
const isRole = (group: string | undefined): group is CumulativeRole => group !== undefined && ROLES.includes(group);

/** Lexicon cumulative-table: the heading words of the this-period and cumulative columns, and the row labels of levels. */
const wordsOf = (doc: ProseDocument): CumulativeWord[] =>
  (doc.lexicons["cumulative-table"] ?? []).flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : []));

export const cumulativeBelow: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (words.length === 0) return [];
  const tables = tablesOf(linesOf(proseAndTablesOf(doc))).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) }));
  return cumulativeBelowCurrent(tables, words).map((issue) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
