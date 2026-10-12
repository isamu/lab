// tax-mismatch: the reading half. The words of a tax row, a total row, an included tax and a service charge come from the
// language's lexicons (tax-label, total-label, tax-included-word, service-charge-label); the amounts are the structure tree's.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { taxMismatches, type TaxWords } from "../structure/tax.ts";
import { amountsOf, quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): TaxWords => ({
  labels: patternsOf(doc, "tax-label"),
  totals: patternsOf(doc, "total-label"),
  included: patternsOf(doc, "tax-included-word"),
  charges: patternsOf(doc, "service-charge-label"),
});

export const taxAmount: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : taxMismatches(doc.source, amountsOf(doc.structure), wordsOf(doc)).map((issue) => ({
        rule: "tax-mismatch",
        severity: "error",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, issue.offset),
        values: { ...issue.values, offset: issue.offset },
      }));
