// capacity-runtime-mismatch: a stated runtime longer than the battery capacity divided by the consumption (derived/battery-runtime.ts).
// Values are read from table rows (item name, value) and from "item name: value" lines. One key-value table and the labelled
// lines of one section are one device; a wider table is one device per column.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import {
  capacityRuntimeMismatches,
  isPeakHeading,
  labelOf,
  splitCondition,
  valueOf,
  type BatteryWords,
  type ElectricUnit,
  type Entry,
  type Family,
  type Marker,
} from "../derived/battery-runtime.ts";
import { quoteAt } from "./structure-tree.ts";

const FAMILIES: readonly Family[] = ["charge", "current", "energy", "power"];
const isFamily = (group: string | undefined): group is Family => FAMILIES.some((family) => family === group);

type Lexicons = ProseDocument["lexicons"];

const markersOf = (lexicons: Lexicons, id: string, group?: string): Marker[] =>
  (lexicons[id] ?? [])
    .filter((entry) => group === undefined || entry.group === group)
    .map((entry) => ({ pattern: entry.pattern, position: entry.position ?? "before" }));

export const batteryWordsOf = (lexicons: Lexicons): BatteryWords => {
  const labels = (lexicons["battery-label"] ?? []).map((entry) => ({ pattern: entry.pattern, group: entry.group ?? "" }));
  const bounds = markersOf(lexicons, "battery-label", "bound");
  return {
    electric: (lexicons["battery-unit"] ?? []).flatMap((entry): ElectricUnit[] =>
      isFamily(entry.group) ? [{ pattern: entry.pattern, weight: entry.weight ?? 1, family: entry.group }] : [],
    ),
    time: (lexicons["unit-time"] ?? []).map((entry) => ({ pattern: entry.pattern, weight: entry.weight ?? 1 })),
    approximate: markersOf(lexicons, "approximate-marker").filter((marker) => !bounds.some((bound) => bound.pattern === marker.pattern)),
    bounds,
    connectors: (lexicons["range-connector"] ?? []).map((entry) => entry.pattern),
    labels,
  };
};

const EMPHASIS = /[*`]/gu;
const plain = (text: string): string => text.replace(EMPHASIS, "");

type Slot = { readonly key: string; readonly entry: Entry };

const entryOf = (label: string, value: Cell, words: BatteryWords, columnPeak: boolean): Entry | undefined => {
  const named = labelOf(plain(label), words);
  const text = plain(value.text).trim();
  const read = named === undefined ? undefined : valueOf(text, named.role, words);
  if (named === undefined || read === undefined) return undefined;
  const lead = value.text.length - value.text.trimStart().length;
  return {
    ...named,
    peak: named.peak || read.peak || columnPeak,
    condition: named.condition === "" ? splitCondition(text).condition : named.condition,
    reading: read.reading,
    start: value.start + lead,
    text,
  };
};

const sectionAt = (doc: ProseDocument, offset: number): number => doc.sections.findLastIndex((section) => section.span.start <= offset);

const TWO_COLUMNS = 2;

const tableSlots = (doc: ProseDocument, words: BatteryWords): Slot[] =>
  tablesOf(linesOf(doc.source)).flatMap((table) => {
    const headings = cellsOf(table.header);
    const wide = headings.length > TWO_COLUMNS;
    return table.rows.flatMap((row) => {
      const [label, ...values] = cellsOf(row);
      if (label === undefined) return [];
      return values.flatMap((value, index): Slot[] => {
        const column = index + 1;
        const peak = wide && isPeakHeading(plain(headings[column]?.text ?? ""), words);
        const entry = entryOf(label.text, value, words, peak);
        const key = wide ? `table ${table.header.start} ${column}` : `section ${sectionAt(doc, row.start)}`;
        return entry === undefined || (!wide && column > 1) ? [] : [{ key, entry }];
      });
    });
  });

/** "Battery life: up to 10 hours", "- 消費電流：500 mA". */
const LABEL_LINE = /^(\s*(?:[-*+]\s+|\d+[.)]\s+)?)([^:：|]{1,80}?)\s*[:：]\s*(.+?)\s*$/u;

const lineSlot = (doc: ProseDocument, line: Line, words: BatteryWords): Slot[] => {
  const match = LABEL_LINE.exec(line.text);
  const [, marker, label, value] = match ?? [];
  if (match === null || marker === undefined || label === undefined || value === undefined) return [];
  const start = line.start + line.text.lastIndexOf(value);
  const entry = entryOf(label, { start, end: start + value.length, text: value }, words, false);
  return entry === undefined ? [] : [{ key: `section ${sectionAt(doc, line.start)}`, entry }];
};

const HOUR_DECIMALS = 100;

export const capacityRuntime: Detector = (doc): Finding[] => {
  const words = batteryWordsOf(doc.lexicons);
  const lines = linesOf(doc.prose ?? doc.source).filter((line) => !line.text.includes("|"));
  const slots = [...tableSlots(doc, words), ...lines.flatMap((line) => lineSlot(doc, line, words))];
  const keys = [...new Set(slots.map((slot) => slot.key))];
  return keys
    .flatMap((key) => capacityRuntimeMismatches(slots.filter((slot) => slot.key === key).map((slot) => slot.entry)))
    .map((mismatch) => ({
      rule: "capacity-runtime-mismatch",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, mismatch.runtime.start),
      values: {
        capacity: mismatch.capacity.text,
        consumption: mismatch.consumption.text,
        runtime: mismatch.runtime.text,
        expected: Math.round(mismatch.idealHours * HOUR_DECIMALS) / HOUR_DECIMALS,
        offset: mismatch.runtime.start,
      },
    }));
};
