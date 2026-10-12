// line-amount-mismatch: the reading half. The column names come from the language's lexicons (quantity-column,
// unit-price-column, line-amount-column), the units from rate-unit, per-unit-mark and the measure lexicons (unit-volume, …); the tables are read from the prose with its tables put back, so code is not.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { measureUnitsOf } from "../facts/measure-units.ts";
import { quantityWordsOf } from "./order-quantity.ts";
import { lineAmountMismatches, type LineAmountWords } from "../structure/line-amount.ts";
import type { UnitWord } from "../structure/line-amount-unit.ts";
import { proseAndTablesOf } from "../table-text.ts";
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
});

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

const issuesOf = (doc: ProseDocument): ReturnType<typeof lineAmountMismatches> => {
  const text = proseAndTablesOf(doc);
  return [...lineAmountMismatches(text, wordsOf(doc)), ...pointsMismatches(text, headingStarts(doc), pointsWordsOf(doc))];
};

export const lineAmount: Detector = (doc): Finding[] =>
  issuesOf(doc).map((issue) => ({
    rule: "line-amount-mismatch",
    severity: "error",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
