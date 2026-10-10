// meter-usage-mismatch: the reading half. The names of the readings come from the language's meter-reading-label lexicon,
// the units from meter-unit, the stated rollover and meter replacement from meter-event; the readings are read from the
// prose with its tables put back, so code is not, and the document's headings split it into sections.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { lineNumberAt, linesOf } from "../structure/lines.ts";
import { meterUsageMismatches, type MeterKind, type MeterUnitWord, type MeterWords } from "../structure/meter-usage.ts";
import { meterGroups, type MeterLabel } from "../structure/meter-usage-read.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";

const KINDS: ReadonlySet<string> = new Set(["current", "previous", "usage", "multiplier"]);

const isKind = (group: string | undefined): group is MeterKind => group !== undefined && KINDS.has(group);

const labelsOf = (doc: ProseDocument): MeterLabel[] =>
  (doc.lexicons["meter-reading-label"] ?? []).flatMap((entry) => (isKind(entry.group) ? [{ pattern: entry.pattern, kind: entry.group }] : []));

const unitsOf = (doc: ProseDocument): MeterUnitWord[] =>
  (doc.lexicons["meter-unit"] ?? []).flatMap((entry) => (entry.group === undefined ? [] : [{ pattern: entry.pattern, unit: entry.group }]));

const eventsOf = (doc: ProseDocument, group: string): string[] =>
  (doc.lexicons["meter-event"] ?? []).filter((entry) => entry.group === group).map((entry) => entry.pattern);

const headingLinesOf = (doc: ProseDocument): number[] => {
  const lines = linesOf(doc.source);
  return (doc.markup?.headings ?? []).flatMap((heading) => lineNumberAt(lines, heading.start) ?? []);
};

export const meterUsage: Detector = (doc): Finding[] => {
  const labels = labelsOf(doc);
  if (labels.length === 0) return [];
  const units = unitsOf(doc);
  const words: MeterWords = { units, rollover: eventsOf(doc, "rollover"), replaced: eventsOf(doc, "replaced") };
  const groups = meterGroups(proseAndTablesOf(doc), headingLinesOf(doc), { labels, units });
  return meterUsageMismatches(groups, words).map((issue) => ({
    rule: "meter-usage-mismatch",
    severity: "error",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
