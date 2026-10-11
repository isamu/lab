// net-over-gross: the reading half. Reads the document's Markdown tables, the lexicon net-gross-weight-column and the
// mass units of unit-mass, and leaves the deciding to structure/net-gross-weight.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { netOverGross, type WeightRole, type WeightWords } from "../structure/net-gross-weight.ts";

const RULE = "net-over-gross";
const ROLES: readonly string[] = ["net", "gross"] satisfies readonly WeightRole[];
const isRole = (group: string | undefined): group is WeightRole => group !== undefined && ROLES.includes(group);

/**
 * Lexicon net-gross-weight-column: the heading words that say which column holds the net and the gross weight, and (group
 * qualifier) the words after a number that make it no exact weight. Lexicon unit-mass: the factor of each mass unit.
 */
const weightWordsOf = (doc: ProseDocument): WeightWords => {
  const entries = doc.lexicons["net-gross-weight-column"] ?? [];
  return {
    columns: entries.flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : [])),
    qualifiers: entries.flatMap((entry) => (entry.group === "qualifier" ? [entry.pattern] : [])),
    units: (doc.lexicons["unit-mass"] ?? []).flatMap((entry) => (entry.weight === undefined ? [] : [{ pattern: entry.pattern, factor: entry.weight }])),
  };
};

export const netOverGrossDetector: Detector = (doc): Finding[] => {
  const words = weightWordsOf(doc);
  if (words.columns.length === 0) return [];
  const tables = tablesOf(linesOf(proseAndTablesOf(doc))).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) }));
  return netOverGross(tables, words).map((issue) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
