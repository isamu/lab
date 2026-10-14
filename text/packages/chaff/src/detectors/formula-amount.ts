// formula-amount-mismatch: the reading half. The words of a formula come from the lexicon formula-amount-word (name-rate,
// rate-name, plus, not-included) and percent-unit; the tax words are tax-price-column's, as tax-mismatch reads them, with tax-label and
// tax-included-word for a tax named as included (消費税8%込み). The amounts are
// currency-notation's, read with amount-multiplier's words of scale. The profile may give the tax rate a document leaves out.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { formulaAmountMismatches, type FormulaWords } from "../structure/formula-amount.ts";
import type { TaxPriceRole, TaxPriceWord } from "../structure/tax-price.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";
import { statedAmountsOf } from "./stated-amounts.ts";

const TAX_ROLES: readonly string[] = ["excluded", "included", "rate"] satisfies readonly TaxPriceRole[];
const isTaxRole = (group: string | undefined): group is TaxPriceRole => group !== undefined && TAX_ROLES.includes(group);

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

const taxWordsOf = (doc: ProseDocument): TaxPriceWord[] =>
  (doc.lexicons["tax-price-column"] ?? []).flatMap((entry) => (isTaxRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : []));

const wordsOf = (doc: ProseDocument): FormulaWords => ({
  nameRate: patternsOf(doc, "formula-amount-word", "name-rate"),
  rateName: patternsOf(doc, "formula-amount-word", "rate-name"),
  plus: patternsOf(doc, "formula-amount-word", "plus"),
  percent: patternsOf(doc, "percent-unit"),
  tax: taxWordsOf(doc),
  taxNames: patternsOf(doc, "tax-label"),
  includedWords: patternsOf(doc, "tax-included-word"),
  notIncluded: patternsOf(doc, "formula-amount-word", "not-included"),
});

export const formulaAmount: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  const input = { text, amounts: statedAmountsOf(text, doc), defaultTaxRate: doc.profile?.taxRate };
  return formulaAmountMismatches(input, wordsOf(doc)).map((issue) => ({
    rule: "formula-amount-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
