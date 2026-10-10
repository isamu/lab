// table-unit-mix: the reading half. The scale units, the caption marks and the total labels are the lexicons table-scale-unit,
// table-unit-caption and total-label.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { tableScaleSlips, type TableScaleWords } from "../structure/table-scale.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";

const wordsOf = (doc: ProseDocument): TableScaleWords => ({
  units: (doc.lexicons["table-scale-unit"] ?? []).flatMap((entry) => (entry.weight === undefined ? [] : [{ word: entry.pattern, value: entry.weight }])),
  captionMarks: (doc.lexicons["table-unit-caption"] ?? []).map((entry) => entry.pattern),
  totalLabels: (doc.lexicons["total-label"] ?? []).map((entry) => entry.pattern),
});

const MAX_DECIMALS = 3;
const shown = (value: number): string => value.toLocaleString("en-US", { maximumFractionDigits: MAX_DECIMALS });

export const tableUnitMix: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  return tableScaleSlips(text, wordsOf(doc)).map((slip) => {
    const offset = slip.cell.start + (slip.cell.text.length - slip.cell.text.trimStart().length);
    return {
      rule: "table-unit-mix",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(text, offset),
      variant: slip.kind,
      values: {
        item: slip.item,
        written: slip.cell.text.trim(),
        unit: slip.tableUnit,
        reading: slip.reading === undefined ? "" : shown(slip.reading),
        offset,
      },
    };
  });
};
