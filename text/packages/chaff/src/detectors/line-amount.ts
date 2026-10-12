// line-amount-mismatch: the reading half. The column names come from the language's lexicons (quantity-column,
// unit-price-column, line-amount-column), the units from rate-unit, per-unit-mark and the measure lexicons (unit-volume, …); the tables are read from the prose with its tables put back, so code is not.
// A product in an item cell's brackets is read with label-product-word, currency-notation and amount-multiplier.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { measureUnitsOf } from "../facts/measure-units.ts";
import { quantityWordsOf } from "./order-quantity.ts";
import { lineAmountMismatches, type LineAmountWords } from "../structure/line-amount.ts";
import type { UnitWord } from "../structure/line-amount-unit.ts";
import type { StructureIssue } from "../structure/issues.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { labelProductMismatches, type LabelProductWords } from "../structure/line-amount-label.ts";
import { amountsIn, formsOf } from "./currency-notation.ts";
import { scaleWordsOf } from "./amount-scale.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

const unitWordsOf = (doc: ProseDocument, ...lexicons: string[]): UnitWord[] =>
  lexicons.flatMap((lexicon) =>
    (doc.lexicons[lexicon] ?? []).flatMap((entry) => (entry.group === undefined ? [] : [{ pattern: entry.pattern, unit: entry.group }])),
  );

const wordsOf = (doc: ProseDocument): LineAmountWords => ({
  quantity: patternsOf(doc, "quantity-column"),
  unitPrice: patternsOf(doc, "unit-price-column"),
  amount: patternsOf(doc, "line-amount-column"),
  units: unitWordsOf(doc, "rate-unit"),
  perUnitMarks: unitWordsOf(doc, "per-unit-mark"),
  headerUnits: unitWordsOf(doc, "quantity-column", "unit-price-column", "line-amount-column"),
  measureUnits: measureUnitsOf(doc).flatMap((unit) => (unit.before ? [] : [unit.pattern])),
  orderRoles: quantityWordsOf(doc).columns,
});

const groupOf = (doc: ProseDocument, lexicon: string, group: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => entry.group === group).map((entry) => entry.pattern);

const labelWordsOf = (doc: ProseDocument): LabelProductWords => {
  const [forms, scales] = [formsOf(doc), scaleWordsOf(doc).map((word) => word.word)];
  return {
    times: groupOf(doc, "label-product-word", "times"),
    counts: groupOf(doc, "label-product-word", "count"),
    isMoney: (text) => amountsIn(text, forms, scales).some((amount) => amount.written === text.trim()),
  };
};

const mismatchesOf = (doc: ProseDocument): StructureIssue[] => {
  const text = proseAndTablesOf(doc);
  return [...lineAmountMismatches(text, wordsOf(doc)), ...labelProductMismatches(text, labelWordsOf(doc))];
};

export const lineAmount: Detector = (doc): Finding[] =>
  mismatchesOf(doc).map((issue) => ({
    rule: "line-amount-mismatch",
    severity: "error",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
