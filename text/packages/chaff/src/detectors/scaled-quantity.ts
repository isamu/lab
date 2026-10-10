// One row of a servings table (4人分 / 8人分, Serves 4 / Serves 8) that does not scale by the columns' ratio while the other rows
// do. The column marks, the amounts left to the cook and the spellings of one unit come from the language packages.
import { scaleSlips, type ScaleWords } from "../structure/scaled-quantities.ts";
import type { MeasureUnit } from "../facts/measures.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

const DIMENSIONS = ["unit-mass", "unit-volume"] as const;

const measuresOf = (doc: ProseDocument): MeasureUnit[] =>
  DIMENSIONS.flatMap((dimension) =>
    (doc.lexicons[dimension] ?? []).flatMap((entry) =>
      entry.weight === undefined
        ? []
        : [{ pattern: entry.pattern, dimension, factors: [entry.weight], zero: 0, before: entry.position === "before", context: [] }],
    ),
  );

const wordsOf = (doc: ProseDocument): ScaleWords => ({
  columns: (doc.lexicons["servings-column"] ?? []).map((entry) => ({ pattern: entry.pattern, position: entry.position })),
  unscaled: (doc.lexicons["unscaled-amount"] ?? []).map((entry) => entry.pattern),
  unitForms: (doc.lexicons["scaled-unit-form"] ?? []).map((entry) => ({ pattern: entry.pattern, group: entry.group ?? entry.pattern })),
  measures: measuresOf(doc),
});

const DECIMALS = 1000;
const shown = (amount: number): string => String(Math.round(amount * DECIMALS) / DECIMALS);

export const scaledQuantityMismatch: Detector = (doc): Finding[] =>
  scaleSlips(doc.source, wordsOf(doc)).map((slip) => {
    const offset = slip.cell.start + (slip.cell.text.length - slip.cell.text.trimStart().length);
    return {
      rule: "scaled-quantity-mismatch",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, offset),
      values: {
        item: slip.item.text.trim(),
        written: slip.cell.text.trim(),
        column: slip.heading,
        other: slip.other.text.trim(),
        otherColumn: slip.otherHeading,
        expected: shown(slip.expected),
        scaledRows: slip.scaledRows,
        offset,
      },
    };
  });
