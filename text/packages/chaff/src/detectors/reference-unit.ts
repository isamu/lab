// reference-unit-mismatch: the reading half. The result, reference range and unit columns are found by the language's
// reference-unit-column lexicon and the units read with reference-unit; the tables are read from the prose with its tables
// put back, so code is not.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { referenceUnitMismatches, type ColumnRole, type ColumnWord, type UnitWord } from "../structure/reference-unit.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";

const ROLES: ReadonlySet<string> = new Set(["result", "range", "unit"]);

const isRole = (group: string | undefined): group is ColumnRole => group !== undefined && ROLES.has(group);

const columnsOf = (doc: ProseDocument): ColumnWord[] =>
  (doc.lexicons["reference-unit-column"] ?? []).flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : []));

const unitsOf = (doc: ProseDocument): UnitWord[] =>
  (doc.lexicons["reference-unit"] ?? []).flatMap((entry) => (entry.group === undefined ? [] : [{ pattern: entry.pattern, unit: entry.group }]));

export const referenceUnit: Detector = (doc): Finding[] => {
  const columns = columnsOf(doc);
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
