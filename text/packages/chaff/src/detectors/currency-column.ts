// currency-column-mix: the reading half. The amounts and their currencies are currency-notation's, read with
// amount-multiplier's words of scale; the heading words of a column of currencies or exchange rates are currency-column's.
// The deciding is structure/currency-column.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { currencyColumnMix, type CurrencyColumnWords } from "../structure/currency-column.ts";
import { amountsIn, formsOf } from "./currency-notation.ts";

const RULE = "currency-column-mix";

const wordsOf = (doc: ProseDocument): CurrencyColumnWords => {
  const forms = formsOf(doc);
  const multipliers = (doc.lexicons["amount-multiplier"] ?? []).map((entry) => entry.pattern);
  return {
    currencies: forms.map((form) => ({ pattern: form.pattern, currency: form.currency })),
    columns: (doc.lexicons["currency-column"] ?? []).map((entry) => entry.pattern),
    amountCurrencies: (text) => amountsIn(text, forms, multipliers).map((amount) => amount.currency),
  };
};

export const currencyColumnMixDetector: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (words.currencies.length === 0) return [];
  const text = proseAndTablesOf(doc);
  const tables = tablesOf(linesOf(text)).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) }));
  return currencyColumnMix(tables, words).map((issue) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
