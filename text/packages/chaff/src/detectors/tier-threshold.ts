// tier-threshold-mismatch: the reading half. Reads the tiers a table (name in the first column, a band in another) or a list
// ("Gold: 20 nights or more") defines, the "key: value" lines outside tables with the section they are in, and the lexicons
// tier-label (the keys that state a member's tier), tier-unit (the units a threshold is counted in) and range-band-word (the
// words that bound a band). The deciding is structure/tier-threshold.ts's.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { TABLE_ROW } from "../structure/runs.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { bandWordsOf } from "./range-band.ts";
import type { BandUnit } from "../structure/range-bands.ts";
import { bandIn, plainKey, tierSlips, type KeyValueLine, type TierEntry, type TierWords } from "../structure/tier-threshold.ts";

const RULE = "tier-threshold-mismatch";
const HEADING = /^#{1,6}[ \t]/u;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/u;
const COLON = /[:：]/u;
/** A key longer than this is a sentence with a colon in it, not a label. */
const MAX_KEY = 40;

const isUnitKind = (group: string | undefined): group is BandUnit["kind"] => group === "integer" || group === "continuous";

const tierWordsOf = (doc: ProseDocument): TierWords => ({
  band: {
    ...bandWordsOf(doc.lexicons),
    units: (doc.lexicons["tier-unit"] ?? []).flatMap((entry) =>
      isUnitKind(entry.group) ? [{ pattern: entry.pattern, kind: entry.group, position: entry.position ?? "after" }] : [],
    ),
    headings: [],
  },
  labels: (doc.lexicons["tier-label"] ?? []).filter((entry) => entry.group === "label").map((entry) => entry.pattern),
  others: (doc.lexicons["tier-label"] ?? []).filter((entry) => entry.group === "other").map((entry) => entry.pattern),
});

type Split = { readonly key: string; readonly value: string; readonly valueAt: number };

/** The key and the value of a line or a list item without its marker, and where the value starts in it. */
const splitKeyValue = (text: string): Split | undefined => {
  const marker = LIST_MARKER.exec(text)?.[0] ?? "";
  const body = text.slice(marker.length);
  const colon = COLON.exec(body)?.index;
  const key = colon === undefined ? "" : body.slice(0, colon).trim();
  if (colon === undefined || key === "" || key.length > MAX_KEY) return undefined;
  const after = body.slice(colon + 1);
  const value = after.trim();
  return { key, value, valueAt: marker.length + colon + 1 + (after.length - after.trimStart().length) };
};

/** A heading of the source that the prose blanks (not one inside code). */
const isHeading = (line: Line, prose: string): boolean => HEADING.test(line.text) && prose.slice(line.start, line.start + line.text.length).trim() === "";

const keyValueLines = (doc: ProseDocument, prose: string): KeyValueLine[] => {
  const headings = linesOf(doc.source)
    .filter((line) => isHeading(line, prose))
    .map((line) => line.start);
  return linesOf(prose).flatMap((line) => {
    const split = TABLE_ROW.test(line.text) ? undefined : splitKeyValue(line.text);
    if (split === undefined) return [];
    const section = headings.filter((start) => start <= line.start).length;
    return [{ key: split.key, value: split.value, valueStart: line.start + split.valueAt, section }];
  });
};

/** For each column after the first, the tiers the first column names with that column's cells. */
const tableRuns = (prose: string): TierEntry[][] =>
  tablesOf(linesOf(prose)).flatMap((table) => {
    const rows = table.rows.map(cellsOf);
    const columns = cellsOf(table.header).length;
    return Array.from({ length: Math.max(0, columns - 1) }, (_, index) =>
      rows.flatMap((cells) => {
        const name = cells[0]?.text.trim();
        const text = cells[index + 1]?.text.trim();
        return name === undefined || text === undefined ? [] : [{ name, text }];
      }),
    );
  });

/** Runs of consecutive list items that each state a band after a name ("Gold: 20 nights or more"). Another item ends the run. */
const listRuns = (doc: ProseDocument, words: TierWords): TierEntry[][] =>
  doc.lists.flatMap((list) =>
    list.itemSpans.reduce<TierEntry[][]>(
      (runs, span) => {
        const split = splitKeyValue(doc.source.slice(span.start, span.end).split("\n")[0] ?? "");
        if (split === undefined || bandIn(split.value, words.band) === undefined) return [...runs, []];
        return [...runs.slice(0, -1), [...(runs.at(-1) ?? []), { name: split.key, text: split.value }]];
      },
      [[]],
    ),
  );

export const tierThreshold: Detector = (doc): Finding[] => {
  const words = tierWordsOf(doc);
  if (words.band.units.length === 0) return [];
  const prose = proseAndTablesOf(doc);
  const lines = keyValueLines(doc, prose);
  const labels = new Set(words.labels.map(plainKey));
  if (!lines.some((line) => labels.has(plainKey(line.key)))) return [];
  const tierRuns = [...tableRuns(prose), ...listRuns(doc, words)];
  return tierSlips({ tierRuns, lines }, words).map((slip) => ({
    rule: RULE,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, slip.offset),
    values: { ...slip.values, offset: slip.offset },
  }));
};
