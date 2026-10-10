// reference-number-repeated: the reading half. Reads the document's Markdown tables and the lexicon reference-column, and
// leaves the deciding to structure/reference-number-repeated.ts.
import type { Detector, Finding } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { lineNumberAt, linesOf } from "../structure/lines.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { repeatedReferences } from "../structure/reference-number-repeated.ts";

const RULE = "reference-number-repeated";

export const referenceNumberRepeated: Detector = (doc): Finding[] => {
  const words = (doc.lexicons["reference-column"] ?? []).map((entry) => entry.pattern);
  if (words.length === 0) return [];
  const tables = tablesOf(linesOf(proseAndTablesOf(doc))).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) }));
  const sourceLines = linesOf(doc.source);
  return repeatedReferences(tables, words).map((repeat) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, repeat.offset),
    values: { number: repeat.number, heading: repeat.heading, firstLine: lineNumberAt(sourceLines, repeat.firstOffset) ?? 0, offset: repeat.offset },
  }));
};
