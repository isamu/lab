// The releases a document lists: a run of version headings (## 3.2.0 - 2026-09-14), each with its section, or a run of
// list items that start with a version (- 3.2.0 (2026-09-14): ...). Pure: reads the source, its headings and code fences.
import type { Span } from "../plugin.ts";
import type { Release } from "./install-pin.ts";
import { runsOf, type Line } from "./runs.ts";
import { isVersionHistory, leadingVersion } from "./version-order.ts";

export type Heading = Span & { readonly depth: number; readonly text: string };

const BARE = /\d[\w.-]*/u;

/** The version as compared: 3.2.0 from [v3.2.0]. */
const bareVersion = (label: string): string => BARE.exec(label)?.[0] ?? label;

/** Kept only when its versions read as a history (all versions, newest or oldest first), not as section numbers. */
const asHistory = (run: readonly (Release & { readonly label: string })[]): Release[] =>
  isVersionHistory(run.map((release) => release.label)) ? run.map(({ version, start, end }) => ({ version, start, end })) : [];

/** A heading's section: up to the next heading of its depth or shallower. */
const sectionEnd = (headings: readonly Heading[], index: number, length: number): number => {
  const depth = headings[index]?.depth ?? 0;
  return headings.slice(index + 1).find((later) => later.depth <= depth)?.start ?? length;
};

const headingReleases = (headings: readonly Heading[], length: number): Release[] => {
  const byDepth = new Map<number, (Release & { readonly label: string })[]>();
  headings.forEach((heading, index) => {
    const label = leadingVersion(heading.text);
    if (label === undefined) return;
    const release = { label, version: bareVersion(label), start: heading.start, end: sectionEnd(headings, index, length) };
    byDepth.set(heading.depth, [...(byDepth.get(heading.depth) ?? []), release]);
  });
  return [...byDepth.values()].flatMap(asHistory);
};

const ITEM_MARKER = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]*/u;

const itemReleases = (source: string, run: readonly Line[]): Release[] =>
  asHistory(
    run.flatMap((line) => {
      const text = source.slice(line.start, line.end);
      const marker = ITEM_MARKER.exec(text)?.[0];
      const label = marker === undefined ? undefined : leadingVersion(text.slice(marker.length));
      return label === undefined ? [] : [{ label, version: bareVersion(label), start: line.start, end: line.end }];
    }),
  );

/** Every release the document lists, outside code fences (an example changelog in a block is not the document's). */
export const releasesOf = (source: string, headings: readonly Heading[], fences: readonly Span[]): Release[] => {
  const inFence = (line: Line): boolean => fences.some((fence) => line.start >= fence.start && line.start < fence.end);
  const items = runsOf(source).flatMap((run) =>
    itemReleases(
      source,
      run.filter((line) => line.kind === "list" && !inFence(line)),
    ),
  );
  return [...headingReleases(headings, source.length), ...items].toSorted((left, right) => left.start - right.start);
};
