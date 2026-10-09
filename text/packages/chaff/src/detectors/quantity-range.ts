// quantity-range-reversed: a range of measured quantities whose upper end is below its lower end (5–2 kg, 30〜10 cm,
// 40〜-10℃), decided by structure/amount-range.ts as amount-range-reversed is. The quantities are read with the unit
// lexicons (unit-length, unit-mass, …); the joints are range-connector, range-opener, range-closer and quantity-range-word;
// quantity-change-word (its lead group: a word right before the range) and quantity-bound-label say what makes a pair a
// change and what labels a bound.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { measuredValues, type MeasureUnit } from "../facts/measures.ts";
import { reversedAmountRanges, type AmountRangeWords } from "../structure/amount-range.ts";
import { quantityRangeEnds, unledRanges } from "../structure/quantity-range.ts";
import { AMOUNT } from "./currency-notation.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";

const DIMENSIONS = ["unit-length", "unit-mass", "unit-time", "unit-volume", "unit-data", "unit-temperature", "unit-pressure"] as const;

/** A bare end may carry a minus sign (-10〜-40℃); a hyphen right after a digit or a letter is a range mark (5-10 kg). */
const SIGNED_NUMBER = `(?:[-−－](?=[0-9０-９]))?${AMOUNT}`;

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

const ungroupedOf = (doc: ProseDocument, lexicon: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => entry.group === undefined).map((entry) => entry.pattern);

/** Each unit once per dimension and position; the factors and zero do not matter here, only which unit two ends share. */
const unitsOf = (doc: ProseDocument): MeasureUnit[] => {
  const contexts = doc.lexicons["unit-context"] ?? [];
  return DIMENSIONS.flatMap((dimension) =>
    (doc.lexicons[dimension] ?? [])
      .filter((entry) => entry.weight !== undefined)
      .map((entry) => ({
        pattern: entry.pattern,
        dimension,
        factors: [entry.weight ?? 1],
        zero: 0,
        before: entry.position === "before",
        context: contexts.filter((context) => context.group === entry.pattern).map((context) => context.pattern),
      })),
  );
};

const wordsOf = (doc: ProseDocument): AmountRangeWords => ({
  connectors: [...patternsOf(doc, "range-connector"), ...patternsOf(doc, "quantity-range-word")],
  openers: patternsOf(doc, "range-opener"),
  closers: patternsOf(doc, "range-closer"),
  changes: ungroupedOf(doc, "quantity-change-word"),
  lowers: patternsOf(doc, "quantity-bound-label", "lower"),
  uppers: patternsOf(doc, "quantity-bound-label", "upper"),
  links: patternsOf(doc, "quantity-bound-label", "link"),
  scales: [],
  number: SIGNED_NUMBER,
});

export const quantityRange: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  const reversed = reversedAmountRanges(text, quantityRangeEnds(text, measuredValues(text, unitsOf(doc))), wordsOf(doc));
  return unledRanges(text, reversed, patternsOf(doc, "quantity-change-word", "lead")).map((issue) => ({
    rule: "quantity-range-reversed",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
