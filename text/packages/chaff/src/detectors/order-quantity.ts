// delivered-over-ordered and backorder-mismatch: the reading half. Reads the document's Markdown tables and the lexicon
// order-quantity-column, and leaves the deciding to structure/order-quantity.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { proseAndTablesOf } from "../table-text.ts";
import type { ChangeTable } from "../structure/change-rate-table.ts";
import type { StructureIssue } from "../structure/issues.ts";
import { backorderMismatches, deliveredOverOrdered, type QuantityRole, type QuantityWords } from "../structure/order-quantity.ts";

const ROLES: readonly string[] = ["ordered", "delivered", "backordered"] satisfies readonly QuantityRole[];
const isRole = (group: string | undefined): group is QuantityRole => group !== undefined && ROLES.includes(group);

/**
 * Lexicon order-quantity-column: the heading words that say which column holds the ordered, delivered and backordered
 * count, and (group qualifier) the words after a number that make it no exact count.
 */
const quantityWordsOf = (doc: ProseDocument): QuantityWords => {
  const entries = doc.lexicons["order-quantity-column"] ?? [];
  return {
    columns: entries.flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : [])),
    qualifiers: entries.flatMap((entry) => (entry.group === "qualifier" ? [entry.pattern] : [])),
  };
};

type RowCheck = (tables: readonly ChangeTable[], words: QuantityWords) => StructureIssue[];

const detectorOf =
  (rule: string, check: RowCheck): Detector =>
  (doc): Finding[] => {
    const words = quantityWordsOf(doc);
    if (words.columns.length === 0) return [];
    const tables = tablesOf(linesOf(proseAndTablesOf(doc))).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) }));
    return check(tables, words).map((issue) => ({
      rule,
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, issue.offset),
      values: { ...issue.values, offset: issue.offset },
    }));
  };

export const deliveredOverOrderedDetector: Detector = detectorOf("delivered-over-ordered", deliveredOverOrdered);
export const backorderMismatchDetector: Detector = detectorOf("backorder-mismatch", backorderMismatches);
