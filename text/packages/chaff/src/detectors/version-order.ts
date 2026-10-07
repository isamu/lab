// version-order: a changelog's version headings, or a list or table of releases, with one version out of order
// (structure/version-order.ts).
import { quoteAt } from "./structure-tree.ts";
import { codeFences } from "./code-fences.ts";
import { runsOf, type Line } from "../structure/runs.ts";
import { isVersionHistory, leadingVersion, versionOrderBreaks, type VersionPoint } from "../structure/version-order.ts";
import type { Detector, Finding, MarkupHeading, ProseDocument } from "../plugin.ts";

/** Headings at one depth, under one parent heading: a shallower heading ends the run, a deeper one (### Added) does not. */
const headingRuns = (source: string, headings: readonly MarkupHeading[]): VersionPoint[][] => {
  const runs: VersionPoint[][] = [];
  const open = new Map<number, VersionPoint[]>();
  headings.forEach((heading) => {
    [...open.keys()].filter((depth) => depth > heading.depth).forEach((depth) => open.delete(depth));
    const label = leadingVersion(heading.text);
    if (label === undefined) return;
    const run = open.get(heading.depth) ?? [];
    if (!open.has(heading.depth)) {
      open.set(heading.depth, run);
      runs.push(run);
    }
    const at = source.indexOf(label, heading.start);
    run.push({ offset: at === -1 ? heading.start : at, label });
  });
  return runs;
};

/** The marker of a list item or the first pipe of a table row, before the item's text. */
const ITEM_MARKER = /^[ \t]*(?:[-*+]|\d{1,3}[.)]|\|)[ \t]*/u;

const itemVersions = (source: string, run: readonly Line[]): VersionPoint[] =>
  run.flatMap((line) => {
    const text = source.slice(line.start, line.end);
    const marker = ITEM_MARKER.exec(text)?.[0] ?? "";
    const label = leadingVersion(text.slice(marker.length));
    return label === undefined ? [] : [{ offset: line.start + marker.length, label }];
  });

/** A list in a code fence (an example changelog) is not the document's. */
const outsideFences = (source: string, run: readonly Line[]): Line[] => {
  const fences = codeFences(source);
  return run.filter((line) => !fences.some((fence) => line.start >= fence.start && line.start < fence.end));
};

const pointRuns = (doc: ProseDocument): VersionPoint[][] => [
  ...headingRuns(doc.source, doc.markup?.headings ?? []),
  ...runsOf(doc.source).map((run) => itemVersions(doc.source, outsideFences(doc.source, run))),
];

export const versionOrder: Detector = (doc): Finding[] =>
  pointRuns(doc)
    .filter((run) => isVersionHistory(run.map((point) => point.label)))
    .flatMap(versionOrderBreaks)
    .map((issue) => ({
      rule: "version-order",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, issue.offset),
      values: { ...issue.values, offset: issue.offset },
    }));
