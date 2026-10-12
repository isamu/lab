// share-amount-mismatch: the reading half. Reads the document's Markdown tables, its lines outside tables and where its
// headings start, the lexicon share-amount-label, and leaves the deciding to structure/share-amount.ts.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { TABLE_ROW } from "../structure/runs.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { shareAmountMismatches, type ShareRole, type ShareText, type ShareWords } from "../structure/share-amount.ts";

const RULE = "share-amount-mismatch";
const ROLES: readonly string[] = ["base", "share", "paid"] satisfies readonly ShareRole[];
const isRole = (group: string | undefined): group is ShareRole => group !== undefined && ROLES.includes(group);
const HEADING = /^#{1,6}[ \t]/u;

/** Lexicon share-amount-label: the words of the total, the share and the payment, and (group rounding) the step an amount in a unit may be rounded to. */
const shareWordsOf = (doc: ProseDocument): ShareWords => {
  const entries = doc.lexicons["share-amount-label"] ?? [];
  return {
    labels: entries.flatMap((entry) => (isRole(entry.group) ? [{ pattern: entry.pattern, role: entry.group }] : [])),
    roundings: entries.flatMap((entry) => (entry.group === "rounding" && entry.weight !== undefined ? [{ unit: entry.pattern, step: entry.weight }] : [])),
  };
};

/** A heading of the source that the prose blanks (not one inside code). */
const isHeading = (line: Line, prose: string): boolean => HEADING.test(line.text) && prose.slice(line.start, line.start + line.text.length).trim() === "";

const shareTextOf = (doc: ProseDocument): ShareText => {
  const prose = proseAndTablesOf(doc);
  const lines = linesOf(prose);
  return {
    tables: tablesOf(lines).map((table) => ({ header: cellsOf(table.header), rows: table.rows.map(cellsOf) })),
    lines: lines.filter((line) => !TABLE_ROW.test(line.text) && line.text.trim() !== ""),
    headings: linesOf(doc.source)
      .filter((line) => isHeading(line, prose))
      .map((line) => line.start),
  };
};

export const shareAmount: Detector = (doc): Finding[] => {
  const words = shareWordsOf(doc);
  if (words.labels.length === 0) return [];
  return shareAmountMismatches(shareTextOf(doc), words).map((issue) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
