// line-amount-mismatch: the reading half. The column names come from the language's lexicons (quantity-column,
// unit-price-column, line-amount-column; pack-count-column and pack-price-column for a catalog's packs), the units from rate-unit, per-unit-mark and the measure lexicons (unit-volume, …); the tables are read from the prose with its tables put back, so code is not.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { measureUnitsOf } from "../facts/measure-units.ts";
import { quantityWordsOf } from "./order-quantity.ts";
import { lineAmountMismatches, type LineAmountWords } from "../structure/line-amount.ts";
import type { UnitWord } from "../structure/line-amount-unit.ts";
import { proseAndTablesOf } from "../table-text.ts";
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
  packCount: patternsOf(doc, "pack-count-column"),
  packPrice: patternsOf(doc, "pack-price-column"),
  itemName: patternsOf(doc, "item-name-column"),
  taxIncluded: patternsOf(doc, "tax-included-word"),
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
