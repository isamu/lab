// Pure: a guide screen rewritten to what chaff prints now, for `yarn screens:update`. The lines the page and chaff share
// stay; between them the page's "…" stays where it stood, and the other lines become chaff's. A "{not-run}" or
// "{counts}" line stays a marker when chaff still prints what it stands for.

import { COUNTS_MARKER, NOT_RUN_MARKER, withScreenFills, type ScreenFills } from "../site/src/lib/screenFills.ts";
import { ELISION, fillsFor, missingFills } from "./guide-screens-parse.ts";

/** A pair of lines kept from the page: its index among the page's output lines, and among chaff's. */
type Anchor = { readonly shown: number; readonly actual: number };

const isElision = (line: string): boolean => line.trim() === ELISION;

/** The longest common lines of two lists, as index pairs in order; a "…" line of the page matches nothing. */
export const commonLines = (shown: readonly string[], actual: readonly string[]): Anchor[] => {
  const lengths = Array.from({ length: shown.length + 1 }, () => new Array<number>(actual.length + 1).fill(0));
  const at = (i: number, j: number): number => lengths[i]?.[j] ?? 0;
  const same = (i: number, j: number): boolean => !isElision(shown[i] ?? "") && shown[i] === actual[j];
  shown.toReversed().forEach((_, back) => {
    const i = shown.length - 1 - back;
    const row = lengths[i] ?? [];
    actual.toReversed().forEach((__, backJ) => {
      const j = actual.length - 1 - backJ;
      row[j] = same(i, j) ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    });
  });
  const walk = (i: number, j: number): Anchor[] => {
    if (i >= shown.length || j >= actual.length) return [];
    if (same(i, j) && at(i, j) === at(i + 1, j + 1) + 1) return [{ shown: i, actual: j }, ...walk(i + 1, j + 1)];
    return at(i + 1, j) >= at(i, j + 1) ? walk(i + 1, j) : walk(i, j + 1);
  };
  return walk(0, 0);
};

/**
 * Chaff's lines for a stretch between two kept lines. Where the page's stretch held a "…", it stays: as many of
 * chaff's lines as the page showed before it, the "…", and as many as the page showed after it.
 */
export const stretchLines = (shown: readonly string[], actual: readonly string[]): string[] => {
  const first = shown.findIndex(isElision);
  if (first === -1) return [...actual];
  const after = shown.length - 1 - shown.findLastIndex(isElision);
  if (first + after > actual.length) return [shown[first] ?? ELISION];
  return [...actual.slice(0, first), shown[first] ?? ELISION, ...actual.slice(actual.length - after)];
};

/** Chaff's output lines with the page's lines that chaff still prints, and its "…" lines where they stood. */
export const mergedLines = (shown: readonly string[], actual: readonly string[]): string[] => {
  const anchors = [{ shown: -1, actual: -1 }, ...commonLines(shown, actual), { shown: shown.length, actual: actual.length }];
  return anchors.slice(1).flatMap((anchor, index) => {
    const before = anchors[index] ?? anchor;
    const between = stretchLines(shown.slice(before.shown + 1, anchor.shown), actual.slice(before.actual + 1, anchor.actual));
    return anchor.actual < actual.length ? [...between, actual[anchor.actual] ?? ""] : between;
  });
};

/** The lines with the first run equal to the fill's lines put back as the marker line. */
const withMarker = (lines: readonly string[], fill: string | undefined, marker: string | undefined): string[] => {
  if (fill === undefined || marker === undefined) return [...lines];
  const block = fill.split("\n").map((line) => line.trimEnd());
  const start = lines.findIndex((_, at) => block.every((line, offset) => lines[at + offset] === line));
  return start === -1 ? [...lines] : [...lines.slice(0, start), marker, ...lines.slice(start + block.length)];
};

const markerLine = (shown: string, marker: string): string | undefined => shown.split("\n").find((line) => line.trim() === marker);

const outputOf = (text: string): { readonly lead: string[]; readonly body: string[]; readonly trail: string[] } => {
  const [, ...lines] = text.split("\n").map((line) => line.trimEnd());
  const first = lines.findIndex((line) => line !== "");
  const last = lines.findLastIndex((line) => line !== "");
  if (first === -1) return { lead: lines, body: [], trail: [] };
  return { lead: lines.slice(0, first), body: lines.slice(first, last + 1), trail: lines.slice(last + 1) };
};

/** The screen as the page shows it with its markers filled in from chaff's output, or as it is when one cannot be. */
const filledScreen = (shown: string, fills: ScreenFills): string => (missingFills(shown, fills).length > 0 ? shown : withScreenFills(shown, fills, "update"));

/**
 * A page's screen (its code block's text) rewritten to what chaff printed (`asScreen` output), keeping the prompt line,
 * the blank lines around the output, the page's "…" lines where chaff's lines still let them stand, and the markers.
 */
export const updatedScreen = (shown: string, actual: string): string => {
  const fills = fillsFor(shown, actual);
  const page = outputOf(filledScreen(shown, fills));
  const merged = mergedLines(page.body, outputOf(actual).body);
  const withNotRun = withMarker(merged, fills.notRun, markerLine(shown, NOT_RUN_MARKER));
  const output = withMarker(withNotRun, fills.counts, markerLine(shown, COUNTS_MARKER));
  const prompt = shown.split("\n")[0] ?? "";
  return [prompt, ...page.lead, ...output, ...page.trail].join("\n");
};
