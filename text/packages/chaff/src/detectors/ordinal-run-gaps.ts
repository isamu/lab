// The leads numbering-gap reads for a schedule's numbered runs (第N回, Week N): the first cell of each table's rows, the
// start of each list's items, and the start of each section's other lines. The comparison is structure/ordinal-runs.ts.
import type { ProseDocument, Section } from "../plugin.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { runsOf } from "../structure/runs.ts";
import type { StructureIssue } from "../structure/issues.ts";
import { framesAt, ordinalFramesOf, ordinalRunBreaks, ordinalRuns, type Lead, type OrdinalFrame } from "../structure/ordinal-runs.ts";

type Line = { readonly start: number; readonly text: string };

/** A table, a list or a section's lines: the leads compared as one block, and where the block's first lead is. */
type Block = { readonly leads: readonly Lead[]; readonly start: number };

const EMPHASIS = String.raw`(?:\*\*|__|\*|_)?`;
const TABLE_LEAD = new RegExp(String.raw`^[ \t]*\|?[ \t]*${EMPHASIS}`, "u");
const LIST_LEAD = new RegExp(String.raw`^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?${EMPHASIS}`, "u");
const LINE_LEAD = new RegExp(String.raw`^[ \t\u3000]*${EMPHASIS}`, "u");
const QUOTED_LINE = /^[ \t]*>/u;

const linesOf = (text: string): Line[] => {
  const starts = [0, ...[...text.matchAll(/\n/gu)].map((match) => match.index + 1)];
  return starts.map((start, index) => ({ start, text: text.slice(start, (starts[index + 1] ?? text.length + 1) - 1) }));
};

const lineAt = (text: string, offset: number): string => {
  const end = text.indexOf("\n", offset);
  return text.slice(offset, end === -1 ? text.length : end);
};

const leadOf = (text: string, offset: number, marks: RegExp, frames: readonly OrdinalFrame[]): Lead => {
  const line = lineAt(text, offset);
  const skipped = marks.exec(line)?.[0].length ?? 0;
  return { offset: offset + skipped, read: framesAt(line.slice(skipped), frames) };
};

const tableBlocks = (text: string, frames: readonly OrdinalFrame[]): Block[] =>
  runsOf(text)
    .filter((run) => run[0]?.kind === "table" && run.length > 0)
    .map((run) => ({ leads: run.map((line) => leadOf(text, line.start, TABLE_LEAD, frames)), start: run[0]?.start ?? 0 }));

const isQuotedAt = (source: string, offset: number): boolean => QUOTED_LINE.test(lineAt(source, source.lastIndexOf("\n", offset - 1) + 1));

const listBlocks = (doc: ProseDocument, text: string, frames: readonly OrdinalFrame[]): Block[] =>
  doc.lists
    .filter((list) => !isQuotedAt(doc.source, list.span.start))
    .map((list) => ({ leads: list.itemSpans.map((item) => leadOf(text, item.start, LIST_LEAD, frames)), start: list.span.start }));

const sectionIndexAt = (sections: readonly Section[], offset: number): number => sections.findLastIndex((section) => section.span.start <= offset);

/** The lines outside tables, lists and quotations, one block per section. */
const lineBlocks = (doc: ProseDocument, text: string, frames: readonly OrdinalFrame[]): Block[] => {
  const inList = (offset: number): boolean => doc.lists.some((list) => offset >= list.span.start && offset < list.span.end);
  const bySection = new Map<number, Lead[]>();
  linesOf(text)
    .filter((line) => !line.text.includes("|"))
    .map((line) => leadOf(text, line.start, LINE_LEAD, frames))
    .filter((lead) => lead.read.length > 0 && !inList(lead.offset) && !isQuotedAt(doc.source, lead.offset))
    .forEach((lead) => {
      const key = sectionIndexAt(doc.sections, lead.offset);
      const leads = bySection.get(key) ?? [];
      leads.push(lead);
      bySection.set(key, leads);
    });
  return [...bySection.values()].map((leads) => ({ leads, start: leads[0]?.offset ?? 0 }));
};

/** How many lines above a block are read for a word saying it lists only some items (a caption, a table's header row). */
const LINES_ABOVE = 3;
const LATIN_WORD = /^[A-Za-z][A-Za-z ]*$/u;

const markerTest = (marker: string): ((text: string) => boolean) => {
  if (!LATIN_WORD.test(marker)) return (text) => text.includes(marker);
  const word = new RegExp(String.raw`(?<![A-Za-z])${marker}(?![A-Za-z])`, "iu");
  return (text) => word.test(text);
};

/** The heading over the block and the few lines right above it, as written. */
const contextAbove = (doc: ProseDocument, start: number): string => {
  const section = doc.sections[sectionIndexAt(doc.sections, start)];
  const from = section?.span.start ?? 0;
  const above = linesOf(doc.source.slice(from, start))
    .map((line) => line.text)
    .filter((line) => line.trim() !== "")
    .slice(-LINES_ABOVE);
  return [section?.heading ?? "", ...above].join("\n");
};

/**
 * The skips and repeats in the document's 第N回 / Week N runs. A block whose heading or the lines right above it say it
 * lists only some (抜粋, selected) is not read: its numbers skip by choice.
 */
export const ordinalRunGaps = (doc: ProseDocument): StructureIssue[] => {
  const frames = ordinalFramesOf(doc.lexicons["ordinal-frame"] ?? []);
  if (frames.length === 0) return [];
  const partial = (doc.lexicons["partial-listing-marker"] ?? []).map((entry) => markerTest(entry.pattern));
  const text = proseAndTablesOf(doc);
  return [...tableBlocks(text, frames), ...listBlocks(doc, text, frames), ...lineBlocks(doc, text, frames)]
    .filter((block) => block.leads.some((lead) => lead.read.length > 0))
    .filter((block) => !partial.some((names) => names(contextAbove(doc, block.start))))
    .flatMap((block) => ordinalRuns(block.leads).flatMap(ordinalRunBreaks));
};
