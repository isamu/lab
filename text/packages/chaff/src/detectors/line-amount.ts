// line-amount-mismatch: the reading half. The column names come from the language's lexicons (quantity-column,
// unit-price-column, line-amount-column); the tables are read from the prose with its tables put back, so code is not.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { lineAmountMismatches, type LineAmountWords } from "../structure/line-amount.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): LineAmountWords => ({
  quantity: patternsOf(doc, "quantity-column"),
  unitPrice: patternsOf(doc, "unit-price-column"),
  amount: patternsOf(doc, "line-amount-column"),
});

export const lineAmount: Detector = (doc): Finding[] =>
  lineAmountMismatches(proseAndTablesOf(doc), wordsOf(doc)).map((issue) => ({
    rule: "line-amount-mismatch",
    severity: "error",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
