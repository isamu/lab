// layout-code-mismatch: a listing's layout code (2LDK, "3 bedrooms") against the rooms the same listing names
// (structure/layout-codes.ts). The code letters and counted words are layout-code's, the room names layout-room's, and the
// field names layout-label's.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import {
  foldWidth,
  layoutSlip,
  pairByScope,
  parseBreakdown,
  parseLayoutCode,
  type Breakdown,
  type LayoutCode,
  type LayoutSlip,
  type LayoutWords,
  type LetterGroup,
  type RoomGroup,
} from "../structure/layout-codes.ts";
import { quoteAt } from "./structure-tree.ts";

type LabelGroup = "code" | "breakdown" | "room-column";
type Labels = ReadonlyMap<string, LabelGroup>;

const LETTER_GROUPS: readonly LetterGroup[] = ["living", "dining", "kitchen", "storage", "one-room"];
const ROOM_GROUPS: readonly RoomGroup[] = ["living", "dining", "kitchen", "room", "storage", "unclear"];
const LABEL_GROUPS: readonly LabelGroup[] = ["code", "breakdown", "room-column"];

const letterGroupOf = (group: string | undefined): LetterGroup | undefined => LETTER_GROUPS.find((known) => known === group);

export const layoutWordsOf = (lexicons: ProseDocument["lexicons"]): LayoutWords => {
  const code = lexicons["layout-code"] ?? [];
  return {
    letters: new Map(
      code.flatMap((entry): [string, LetterGroup][] => {
        const group = letterGroupOf(entry.group);
        return group === undefined ? [] : [[entry.pattern, group]];
      }),
    ),
    joiners: code.filter((entry) => entry.group === "joiner").map((entry) => entry.pattern),
    counted: code.filter((entry) => entry.group === "counted").map((entry) => entry.pattern),
    counters: code.filter((entry) => entry.group === "counter").map((entry) => entry.pattern),
    rooms: (lexicons["layout-room"] ?? []).flatMap((entry) => {
      const group = ROOM_GROUPS.find((known) => known === entry.group);
      return group === undefined ? [] : [{ pattern: entry.pattern, group }];
    }),
  };
};

const labelKey = (label: string): string => foldWidth(withoutEdgeMarks(label)).toLowerCase().replace(/\s+/gu, " ");

const labelsOf = (lexicons: ProseDocument["lexicons"]): Labels =>
  new Map(
    (lexicons["layout-label"] ?? []).flatMap((entry): [string, LabelGroup][] => {
      const group = LABEL_GROUPS.find((known) => known === entry.group);
      return group === undefined ? [] : [[labelKey(entry.pattern), group]];
    }),
  );

/** A code found in the page, with the breakdown written right with it when there is one (a row, or 2LDK（洋室6帖・…）). */
type PlacedCode = { readonly code: LayoutCode; readonly scope: number; readonly breakdown?: Breakdown | undefined };
type PlacedBreakdown = { readonly breakdown: Breakdown; readonly scope: number };
type Found = { readonly codes: PlacedCode[]; readonly breakdowns: PlacedBreakdown[] };
const NOTHING: Found = { codes: [], breakdowns: [] };

type Context = { readonly words: LayoutWords; readonly labels: Labels; readonly scopeOf: (offset: number) => number };

const INLINE_BREAKDOWN = /^[^(（]*[(（]([^)）]+)[)）]/u;

/** The breakdown written in brackets after the code, when it names a room. */
const inlineBreakdown = (rest: string, words: LayoutWords): Breakdown | undefined => {
  const inside = INLINE_BREAKDOWN.exec(rest)?.[1];
  if (inside === undefined) return undefined;
  const breakdown = parseBreakdown([inside], words);
  return breakdown.rooms > 0 || breakdown.unclear ? breakdown : undefined;
};

const codeIn = (text: string, start: number, context: Context, breakdown?: Breakdown): PlacedCode[] => {
  const found = parseLayoutCode(text, context.words);
  if (found === undefined) return [];
  const code = { ...found, start: start + found.start, end: start + found.end };
  const written = breakdown ?? inlineBreakdown(text.slice(found.end), context.words);
  return [{ code, scope: context.scopeOf(code.start), breakdown: written }];
};

const field = (group: LabelGroup | undefined, value: string, start: number, context: Context): Found => {
  if (group === "code") return { codes: codeIn(value, start, context), breakdowns: [] };
  if (group === "breakdown") return { codes: [], breakdowns: [{ breakdown: parseBreakdown([value], context.words), scope: context.scopeOf(start) }] };
  return NOTHING;
};

const merged = (found: readonly Found[]): Found => ({
  codes: found.flatMap((each) => each.codes),
  breakdowns: found.flatMap((each) => each.breakdowns),
});

const groupOfCell = (cell: Cell | undefined, labels: Labels): LabelGroup | undefined => (cell === undefined ? undefined : labels.get(labelKey(cell.text)));

/** A table with a layout column: one listing a row, with its breakdown column when the table has one. */
const wideRows = (rows: readonly Cell[][], codeColumn: number, breakdownColumn: number, context: Context): Found => ({
  codes: rows.flatMap((cells) => {
    const code = cells[codeColumn];
    const listed = cells[breakdownColumn];
    const breakdown = listed === undefined ? undefined : parseBreakdown([listed.text], context.words);
    return code === undefined ? [] : codeIn(code.text, code.start, context, breakdown);
  }),
  breakdowns: [],
});

const tableFound = (header: Line, rows: readonly Cell[][], context: Context): Found => {
  const groups = cellsOf(header).map((cell) => groupOfCell(cell, context.labels));
  const codeColumn = groups.indexOf("code");
  if (codeColumn !== -1) return wideRows(rows, codeColumn, groups.indexOf("breakdown"), context);
  if (groups[0] === "room-column") {
    const breakdown = parseBreakdown(
      rows.map((cells) => cells[0]?.text ?? ""),
      context.words,
    );
    return { codes: [], breakdowns: [{ breakdown, scope: context.scopeOf(header.start) }] };
  }
  return merged(rows.map(([label, value]) => (value === undefined ? NOTHING : field(groupOfCell(label, context.labels), value.text, value.start, context))));
};

const tablesFound = (source: string, context: Context): Found =>
  merged(tablesOf(linesOf(source)).map((table) => tableFound(table.header, table.rows.map(cellsOf), context)));

const LIST_LEAD = /^\s*(?:(?:[-*+]|\d+[.)])\s+)?/u;
const MAX_LABEL_LENGTH = 24;

/** "間取り：2LDK", "- Rooms: Bedroom 1, Bedroom 2" outside tables: the name before the first colon, and the value after it. */
const labelledLine = (line: Line, context: Context): Found => {
  const colon = line.text.search(/[:：]/u);
  if (colon === -1 || line.text.includes("|")) return NOTHING;
  const label = line.text.slice(0, colon).replace(LIST_LEAD, "");
  const rest = line.text.slice(colon + 1);
  const value = rest.trimStart();
  if (label.length > MAX_LABEL_LENGTH || value === "") return NOTHING;
  return field(context.labels.get(labelKey(label)), value, line.start + colon + 1 + rest.length - value.length, context);
};

/** Code and markup are masked in prose, so a colon in code is not read. */
const linesFound = (prose: string, context: Context): Found => merged(linesOf(prose).map((line) => labelledLine(line, context)));

const scopeFinder =
  (doc: ProseDocument) =>
  (offset: number): number =>
    doc.sections.findLastIndex((section) => section.span.start <= offset);

const slipsOf = (found: Found): LayoutSlip[] => {
  const direct = found.codes.flatMap((placed): [LayoutCode, Breakdown][] => (placed.breakdown === undefined ? [] : [[placed.code, placed.breakdown]]));
  const pooled = found.codes.filter((placed) => placed.breakdown === undefined);
  const paired = pairByScope(pooled, found.breakdowns).map(([placed, listed]): [LayoutCode, Breakdown] => [placed.code, listed.breakdown]);
  return [...direct, ...paired].flatMap(([code, breakdown]) => layoutSlip(code, breakdown) ?? []);
};

export const layoutCode: Detector = (doc): Finding[] => {
  const context: Context = { words: layoutWordsOf(doc.lexicons), labels: labelsOf(doc.lexicons), scopeOf: scopeFinder(doc) };
  const found = merged([tablesFound(doc.source, context), linesFound(doc.prose ?? doc.source, context)]);
  return slipsOf(found).map((slip) => ({
    rule: "layout-code-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, slip.code.start),
    ...(slip.kind === "part" ? { variant: "part" } : {}),
    values: {
      code: slip.code.text,
      stated: slip.code.rooms,
      ...(slip.kind === "count" ? { listed: slip.listed } : { part: slip.entry }),
      offset: slip.code.start,
    },
  }));
};
