// reference-unit-mismatch: the reading half. The result, reference range and unit columns are found by the language's
// lab-result-column and reference-unit-column lexicons and the units read with reference-unit; the tables are read from the
// prose with its tables put back, so code is not.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { referenceUnitMismatches, type UnitWord } from "../structure/reference-unit.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { labColumnWordsOf } from "./lab-columns.ts";
import { quoteAt } from "./structure-tree.ts";

const unitsOf = (doc: ProseDocument): UnitWord[] =>
  (doc.lexicons["reference-unit"] ?? []).flatMap((entry) => (entry.group === undefined ? [] : [{ pattern: entry.pattern, unit: entry.group }]));

export const referenceUnit: Detector = (doc): Finding[] => {
  const columns = labColumnWordsOf(doc, "reference-unit-column");
  if (columns.length === 0) return [];
  return referenceUnitMismatches(proseAndTablesOf(doc), { units: unitsOf(doc), columns }).map((issue) => ({
    rule: "reference-unit-mismatch",
    severity: "error",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
