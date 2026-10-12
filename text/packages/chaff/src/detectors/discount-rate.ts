// discount-rate-mismatch: the reading half. Reads the document's Markdown tables, its lines outside tables with the amounts
// of money in them (currency-notation), the lexicon discount-rate-label, and leaves the deciding to structure/discount-rate.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { amountsIn, formsOf } from "./currency-notation.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { TABLE_ROW } from "../structure/runs.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { discountRateMismatches, type DiscountRole, type DiscountText, type DiscountWord } from "../structure/discount-rate.ts";

const RULE = "discount-rate-mismatch";
const ROLES: readonly string[] = ["rate", "price", "list", "not", "per"] satisfies readonly DiscountRole[];
const isRole = (group: string | undefined): group is DiscountRole => group !== undefined && ROLES.includes(group);

const discountWordsOf = (doc: ProseDocument): DiscountWord[] =>
  (doc.lexicons["discount-rate-label"] ?? []).flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : []));

const discountTextOf = (doc: ProseDocument): DiscountText => {
  const lines = linesOf(proseAndTablesOf(doc));
  const forms = formsOf(doc);
  return {
    tables: tablesOf(lines).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) })),
    lines: lines
      .filter((line) => !TABLE_ROW.test(line.text) && line.text.trim() !== "")
      .map((line) => ({ text: line.text, amounts: amountsIn(line.text, forms, []) })),
  };
};

export const discountRate: Detector = (doc): Finding[] => {
  const words = discountWordsOf(doc);
  if (words.length === 0) return [];
  return discountRateMismatches(discountTextOf(doc), words).map((issue) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
