// range-band-mismatch: neighbouring bands of one table column or one list that overlap or leave a gap (structure/range-bands.ts).
// The words that bound a band are range-band-word's, the units range-band-unit's, and the column headings that say what bare
// numbers count range-band-heading's.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { linesOf } from "../structure/lines.ts";
import {
  bandSlips,
  headingOf,
  parseBand,
  runKindOf,
  type BandMarker,
  type BandSlip,
  type BandWords,
  type PlacedBand,
  type UnitKind,
} from "../structure/range-bands.ts";
import { quoteAt } from "./structure-tree.ts";

const MARKER_GROUPS: Readonly<Record<string, Pick<BandMarker, "side" | "kind">>> = {
  "lower-inclusive": { side: "low", kind: "inclusive" },
  "lower-exclusive": { side: "low", kind: "exclusive" },
  "upper-inclusive": { side: "high", kind: "inclusive" },
  "upper-exclusive": { side: "high", kind: "exclusive" },
};

const isUnitKind = (group: string | undefined): group is UnitKind => group === "integer" || group === "continuous";

export const bandWordsOf = (lexicons: ProseDocument["lexicons"]): BandWords => {
  const words = lexicons["range-band-word"] ?? [];
  const patterns = (group: string): string[] => words.filter((entry) => entry.group === group).map((entry) => entry.pattern);
  return {
    connectors: patterns("connector"),
    openers: words.filter((entry) => entry.group === "connector" && entry.position === "before").map((entry) => entry.pattern),
    leads: patterns("lead"),
    markers: words.flatMap((entry) => {
      const marker = MARKER_GROUPS[entry.group ?? ""];
      return marker === undefined ? [] : [{ pattern: entry.pattern, ...marker, position: entry.position ?? "after" }];
    }),
    units: (lexicons["range-band-unit"] ?? []).flatMap((entry) =>
      isUnitKind(entry.group) ? [{ pattern: entry.pattern, kind: entry.group, position: entry.position ?? "after" }] : [],
    ),
    headings: (lexicons["range-band-heading"] ?? []).flatMap((entry) => (isUnitKind(entry.group) ? [{ pattern: entry.pattern, kind: entry.group }] : [])),
  };
};

type Slot = { readonly text: string; readonly start: number; readonly end: number };

/** Runs of consecutive slots that each state a band. A slot that is not one (合計, a blank) ends the run. */
const bandRuns = (slots: readonly (Slot | undefined)[], words: BandWords): PlacedBand[][] =>
  slots
    .reduce<PlacedBand[][]>(
      (runs, slot) => {
        const band = slot === undefined ? undefined : parseBand(slot.text, words);
        if (slot === undefined || band === undefined) return [...runs, []];
        const last = runs.at(-1) ?? [];
        return [...runs.slice(0, -1), [...last, { band, start: slot.start, end: slot.end, text: slot.text.trim() }]];
      },
      [[]],
    )
    .filter((run) => run.length > 1);

const slipsOfRuns = (runs: readonly PlacedBand[][], heading: ReturnType<typeof headingOf>, words: BandWords): BandSlip[] =>
  runs.flatMap((run) => {
    const kind = runKindOf(
      run.map((placed) => placed.band),
      heading,
      words,
    );
    return kind === undefined ? [] : bandSlips(run, kind);
  });

const trimmedSlot = (text: string, start: number): Slot => {
  const lead = text.length - text.trimStart().length;
  return { text: text.trim(), start: start + lead, end: start + lead + text.trim().length };
};

const tableSlips = (source: string, words: BandWords): BandSlip[] =>
  tablesOf(linesOf(source)).flatMap((table) => {
    const headings = cellsOf(table.header);
    const rows = table.rows.map(cellsOf);
    return headings.flatMap((heading, column) =>
      slipsOfRuns(
        bandRuns(
          rows.map((cells) => {
            const cell = cells[column];
            return cell === undefined ? undefined : trimmedSlot(cell.text, cell.start);
          }),
          words,
        ),
        headingOf(heading.text, words),
        words,
      ),
    );
  });

const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/u;
/** Where the band at the head of a list item ends: a colon, a comma, a bracket, or a dash set off by spaces. */
const ITEM_HEAD_END = /[:：、,，(（]|\s[-–—]\s|\t/u;

const listSlips = (doc: ProseDocument, words: BandWords): BandSlip[] =>
  doc.lists.flatMap((list) => {
    const heads = list.itemSpans.map((span): Slot | undefined => {
      const item = doc.source.slice(span.start, span.end).split("\n")[0] ?? "";
      const marker = LIST_MARKER.exec(item)?.[0];
      if (marker === undefined) return undefined;
      const body = item.slice(marker.length);
      const end = ITEM_HEAD_END.exec(body)?.index ?? body.length;
      return trimmedSlot(body.slice(0, end), span.start + marker.length);
    });
    return slipsOfRuns(bandRuns(heads, words), undefined, words);
  });

export const rangeBand: Detector = (doc): Finding[] => {
  const words = bandWordsOf(doc.lexicons);
  return [...tableSlips(doc.source, words), ...listSlips(doc, words)].map((slip) => ({
    rule: "range-band-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, slip.later.start),
    ...(slip.kind === "gap" ? { variant: "gap" } : {}),
    values: { earlier: slip.earlier.text, later: slip.later.text, offset: slip.later.start },
  }));
};
