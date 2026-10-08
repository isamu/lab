// version-order: a changelog's version headings, or a list or table of releases, with one version out of order
// (structure/version-order.ts).
import { quoteAt } from "./structure-tree.ts";
import { codeFences } from "./code-fences.ts";
import { siblingHeadingRunsOf } from "../structure/heading-runs.ts";
import { runsOf, type Line } from "../structure/runs.ts";
import { isVersionHistory, leadingVersion, versionOrderBreaks, type VersionPoint } from "../structure/version-order.ts";
import type { Detector, Finding, MarkupHeading, ProseDocument } from "../plugin.ts";

const headingPoint = (source: string, heading: MarkupHeading): VersionPoint | undefined => {
  const label = leadingVersion(heading.text);
  if (label === undefined) return undefined;
  const at = source.indexOf(label, heading.start);
  return { offset: at === -1 ? heading.start : at, label };
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
  ...siblingHeadingRunsOf(doc.markup?.headings ?? [], (heading) => headingPoint(doc.source, heading)),
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
