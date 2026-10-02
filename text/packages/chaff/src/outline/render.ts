import type { LengthUnit } from "../plugin.ts";
import type { Outline, OutlineEntry, Shape } from "./shape.ts";
import type { OutlineText } from "./text.ts";
import type { StructureScore } from "../structure-shape/score.ts";
import { structureChangeLines, structureCompact, structureJson, structureLines } from "./structure-render.ts";

/** One file's outline as `chaff outline` shows it, with its structure measures placed against human articles. */
export type DocumentOutline = { readonly path: string; readonly language: string; readonly outline: Outline; readonly structure: StructureScore };

type Measure = { readonly name: string; readonly value: (shape: Shape, unit: LengthUnit) => string };

/** The shape's measures in the order they are shown. */
const measuresOf = (text: OutlineText): readonly Measure[] => [
  { name: text.headings, value: (shape) => String(shape.headings) },
  { name: text.averageSection, value: (shape, unit) => text.length(shape.averageSectionLength, unit) },
  { name: text.lists, value: (shape) => `${String(shape.listPercent)}%` },
  { name: text.bold, value: (shape) => String(shape.bold) },
];

/** The shape's measures on one line: 見出し 6、節の平均 120 字、… / headings 6, average section 80 words, … */
export const shapeMeasures = (shape: Shape, unit: LengthUnit, text: OutlineText): string =>
  measuresOf(text)
    .map((measure) => text.measure(measure.name, measure.value(shape, unit)))
    .join(text.separator);

const shapeLine = (document: DocumentOutline, text: OutlineText): string =>
  text.shapeOf(document.path, shapeMeasures(document.outline.shape, document.outline.unit, text));

const headingOf = (entry: OutlineEntry, text: OutlineText): string => (entry.depth === 0 ? text.lead : `${"#".repeat(entry.depth)} ${entry.heading}`);

/** A heading indented by its depth, where it is, and how long its own text is. */
const entryLine = (entry: OutlineEntry, document: DocumentOutline, text: OutlineText): string => {
  const indent = "  ".repeat(Math.max(entry.depth - 1, 0));
  const length = text.length(entry.length, document.outline.unit);
  return `  ${indent}${headingOf(entry, text)}  (${document.path}:${String(entry.line)})  ${length}`;
};

const outlineBlock = (document: DocumentOutline, text: OutlineText): string[] => [
  shapeLine(document, text),
  "",
  ...document.outline.entries.map((entry) => entryLine(entry, document, text)),
  "",
  ...structureLines(document.structure, document.language, document.outline.unit, text.structure),
];

/** Each measure before and after, so a restructure shows as numbers that moved. */
const changeBlock = (before: DocumentOutline, after: DocumentOutline, text: OutlineText): string[] => [
  "",
  text.changed(before.path, after.path),
  ...measuresOf(text).map(
    (measure) => `  ${measure.name}: ${measure.value(before.outline.shape, before.outline.unit)} → ${measure.value(after.outline.shape, after.outline.unit)}`,
  ),
  ...structureChangeLines(before.structure, after.structure, [before.outline.unit, after.outline.unit], text.structure),
];

/** For a person: each file's shape and outline, then, for two files, how each measure moved. */
export const renderOutlineFriendly = (documents: readonly DocumentOutline[], text: OutlineText): string => {
  const [before, after] = documents;
  const outlines = documents.flatMap((document, index) => [...(index > 0 ? [""] : []), ...outlineBlock(document, text)]);
  return [...outlines, ...(before !== undefined && after !== undefined ? changeBlock(before, after, text) : [])].join("\n");
};

const COMPACT_UNIT: Readonly<Record<LengthUnit, string>> = { char: "chars", word: "words" };

const compactEntry = (entry: OutlineEntry, document: DocumentOutline): string => {
  const heading = entry.depth === 0 ? "lead" : `h${String(entry.depth)} ${entry.heading}`;
  return `${document.path}:${String(entry.line)}: ${heading} (${String(entry.length)} ${COMPACT_UNIT[document.outline.unit]})`;
};

/** For grep: one section per line, then each file's shape. */
export const renderOutlineCompact = (documents: readonly DocumentOutline[], text: OutlineText): string =>
  [
    ...documents.flatMap((document) => document.outline.entries.map((entry) => compactEntry(entry, document))),
    ...documents.map((document) => shapeLine(document, text)),
    ...documents.map((document) => structureCompact(document.path, document.structure)),
  ].join("\n");

const outlineJson = (document: DocumentOutline): Readonly<Record<string, unknown>> => ({
  path: document.path,
  language: document.language,
  unit: document.outline.unit,
  shape: document.outline.shape,
  outline: document.outline.entries,
  structure: structureJson(document.structure),
});

/** For an AI: one file's outline and shape, or `before` and `after` for two. */
export const renderOutlineJson = (documents: readonly DocumentOutline[]): string => {
  const [before, after] = documents;
  const body = before !== undefined && after !== undefined ? { before: outlineJson(before), after: outlineJson(after) } : documents.map(outlineJson)[0];
  return JSON.stringify(body, null, 2);
};
