// line-amount-mismatch: the reading half. The column names come from the language's lexicons (quantity-column,
// unit-price-column, line-amount-column; pack-count-column and pack-price-column for a catalog's packs), the units from rate-unit, per-unit-mark and the measure lexicons (unit-volume, …); the tables are read from the prose with its tables put back, so code is not.
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
import { pointsMismatches, type PointsRole, type PointsWords } from "../structure/line-amount-rate.ts";
import { linesOf } from "../structure/lines.ts";

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

const POINTS_ROLES: readonly string[] = ["base", "rate", "earned"] satisfies readonly PointsRole[];
const isPointsRole = (group: string | undefined): group is PointsRole => group !== undefined && POINTS_ROLES.includes(group);
const HEADING = /^#{1,6}[ \t]/u;

/** Lexicons points-earned-column (group base, rate or earned; a rate's weight is what a bare rate is per), points-unit, points-rate-joiner. */
const pointsWordsOf = (doc: ProseDocument): PointsWords => ({
  columns: (doc.lexicons["points-earned-column"] ?? []).flatMap((entry) =>
    isPointsRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group, per: entry.weight }] : [],
  ),
  units: patternsOf(doc, "points-unit"),
  joiners: patternsOf(doc, "points-rate-joiner"),
});

/** Where each heading of the source starts: the prose blanks headings, and a stated rate is read only in its table's section. */
const headingStarts = (doc: ProseDocument): number[] =>
  linesOf(doc.source)
    .filter((line) => HEADING.test(line.text))
    .map((line) => line.start);

const mismatchesOf = (doc: ProseDocument): StructureIssue[] => {
  const text = proseAndTablesOf(doc);
  return [
    ...lineAmountMismatches(text, wordsOf(doc)),
    ...labelProductMismatches(text, labelWordsOf(doc)),
    ...pointsMismatches(text, headingStarts(doc), pointsWordsOf(doc)),
  ];
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
