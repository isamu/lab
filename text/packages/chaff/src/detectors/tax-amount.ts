// tax-mismatch: the reading half. The words of a tax row, a total row and an included tax come from the language's
// lexicons (tax-label, total-label, tax-included-word); the amounts are the structure tree's. The tax-excluded and
// tax-included price columns of a price list come from the lexicon tax-price-column and the document's Markdown tables.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { taxMismatches, type TaxWords } from "../structure/tax.ts";
import { taxIncludedPriceMismatches, type TaxPriceRole, type TaxPriceText, type TaxPriceWord } from "../structure/tax-price.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { TABLE_ROW } from "../structure/runs.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { amountsOf, quoteAt } from "./structure-tree.ts";
import type { StructureIssue } from "../structure/issues.ts";

const RULE = "tax-mismatch";
const PRICE_ROLES: readonly string[] = ["excluded", "included", "rate"] satisfies readonly TaxPriceRole[];
const isPriceRole = (group: string | undefined): group is TaxPriceRole => group !== undefined && PRICE_ROLES.includes(group);

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): TaxWords => ({
  labels: patternsOf(doc, "tax-label"),
  totals: patternsOf(doc, "total-label"),
  included: patternsOf(doc, "tax-included-word"),
});

const priceWordsOf = (doc: ProseDocument): TaxPriceWord[] =>
  (doc.lexicons["tax-price-column"] ?? []).flatMap((entry) => (isPriceRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : []));

const priceTextOf = (doc: ProseDocument): TaxPriceText => {
  const lines = linesOf(proseAndTablesOf(doc));
  return {
    tables: tablesOf(lines).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) })),
    lines: lines.filter((line) => !TABLE_ROW.test(line.text) && line.text.trim() !== "").map((line) => line.text),
  };
};

const findingOf = (doc: ProseDocument, issue: StructureIssue, variant?: string): Finding => ({
  rule: RULE,
  severity: "error",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, issue.offset),
  values: { ...issue.values, offset: issue.offset },
  ...(variant === undefined ? {} : { variant }),
});

const priceFindings = (doc: ProseDocument): Finding[] => {
  const words = priceWordsOf(doc);
  return words.length === 0 ? [] : taxIncludedPriceMismatches(priceTextOf(doc), words).map((issue) => findingOf(doc, issue, "price"));
};

export const taxAmount: Detector = (doc): Finding[] => [
  ...(doc.structure === undefined ? [] : taxMismatches(doc.source, amountsOf(doc.structure), wordsOf(doc)).map((issue) => findingOf(doc, issue))),
  ...priceFindings(doc),
];
