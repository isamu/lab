// A number written bare where the same document gives that kind of value a unit: one cell of a table column, or one
// "label: value" line, where the column's or label's other values all carry the same unit (300円, 200円, 150).
// Pure; reads the Markdown tables and the label lines of the prose. Which words are units comes from the language's lexicons.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { readMarkdown } from "../markdown-read.ts";
import { spanOf, type MarkdownNode } from "../markdown-node.ts";
import { eachPreOrder } from "../tree-walk.ts";
import { quoteAt } from "./structure-tree.ts";

/** One value of a kind: where its number starts, as written, and its unit ("" when bare). */
export type Measured = { readonly kind: string; readonly name: string; readonly offset: number; readonly written: string; readonly unit: string };

export type UnitGap = { readonly value: Measured; readonly unit: string };

/** The lexicons that name units. */
export const UNIT_LEXICONS = ["value-unit", "measure-unit", "percent-unit", "currency-code"] as const;

const CURRENCY = new Set(["$", "¥", "€", "£"]);
const SIGN = new Set(["-", "−"]);
const MULTIPLIER = new Set(["万", "億", "千"]);
const NUMBER = /^\d[\d,]*(?:\.\d+)?/u;
/** What may follow a number as its unit: a short run with no digit, space or separator ("1.2.3" and "2026-10-14" are not values). */
const UNIT_SHAPE = /^[^\d\s.,:|()[\]-]{1,8}$/u;

/** A label names something in words: 10:30 is a time, not the label "10". */
const HAS_LETTER = /\p{L}/u;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/u;
const COLON = /[:：]/u;
const MAX_LABEL = 20;

const isUnit = (word: string, units: ReadonlySet<string>): boolean => units.has(word) || units.has(word.toLowerCase());

const withoutFirst = (text: string, marks: ReadonlySet<string>): string => (marks.has(text.charAt(0)) ? text.slice(1).trimStart() : text);

/**
 * The unit of a lone number, signed or not, with a currency mark before it or a unit after it (¥300, 1,200円, -3kg, 45%,
 * 3 kg): the mark or the unit, "" when the number is bare, undefined when the text is not one number. Read after NFKC, so
 * full-width digits count. A word after the number is a unit only if a unit lexicon lists it: "3 fixed" is not a value.
 */
export const unitOf = (text: string, units: ReadonlySet<string>): string | undefined => {
  const value = text.normalize("NFKC").trim();
  const currency = CURRENCY.has(value.charAt(0)) ? value.charAt(0) : "";
  const unsigned = withoutFirst(value.slice(currency.length).trimStart(), SIGN);
  const number = NUMBER.exec(unsigned)?.[0];
  if (number === undefined) return undefined;
  const suffix = withoutFirst(unsigned.slice(number.length).trimStart(), MULTIPLIER);
  if (suffix === "") return currency;
  return currency === "" && UNIT_SHAPE.test(suffix) && isUnit(suffix, units) ? suffix : undefined;
};

const measured = (kind: string, name: string, text: string, offset: number, units: ReadonlySet<string>): Measured[] => {
  const written = text.trim();
  const unit = unitOf(written, units);
  return unit === undefined ? [] : [{ kind, name, offset: offset + Math.max(0, text.indexOf(written)), written, unit }];
};

type LabelLine = { readonly label: string; readonly value: string; readonly at: number };

/** A line that names a field and gives its value (「予算：300万円」 "**Budget:** $300"), list marker and bold allowed. */
export const labelLine = (line: string, start: number): LabelLine | undefined => {
  const marker = LIST_MARKER.exec(line)?.[0].length ?? 0;
  const body = line.slice(marker);
  const colon = body.search(COLON);
  if (colon <= 0) return undefined;
  const label = body.slice(0, colon).replaceAll("**", "").trim();
  const rest = body.slice(colon + 1).replace(/^\*\*/u, "");
  const value = rest.trim();
  if (label.length > MAX_LABEL || label.includes("|") || !HAS_LETTER.test(label) || value === "") return undefined;
  return { label, value, at: start + marker + (body.length - rest.length) + rest.indexOf(value) };
};

const cellText = (source: string, cell: MarkdownNode | undefined): { readonly text: string; readonly start: number } | undefined => {
  const span = cell === undefined ? undefined : spanOf(cell);
  if (span === undefined) return undefined;
  const raw = source.slice(span.start, span.end);
  const lead = raw.search(/[^|\s]/u);
  return lead === -1 ? undefined : { text: raw.slice(lead).replace(/\|\s*$/u, ""), start: span.start + lead };
};

const tableValues = (source: string, table: MarkdownNode, index: number, units: ReadonlySet<string>): Measured[] => {
  const [header, ...body] = table.children ?? [];
  return (header?.children ?? []).flatMap((headCell, column) => {
    const name = cellText(source, headCell)?.text.trim() ?? "";
    return body.flatMap((row) => {
      const cell = cellText(source, row.children?.[column]);
      return cell === undefined || name === "" ? [] : measured(`table ${String(index)}: ${name}`, name, cell.text, cell.start, units);
    });
  });
};

const tablesOf = (source: string): MarkdownNode[] => {
  const found: MarkdownNode[] = [];
  eachPreOrder(readMarkdown(source).root, (node) => {
    if (node.type === "table") found.push(node);
  });
  return found;
};

/** The lines of a text with where each starts. */
const linesWithStarts = (text: string): { readonly line: string; readonly start: number }[] =>
  text.split("\n").reduce<{ readonly line: string; readonly start: number }[]>((lines, line) => {
    const last = lines.at(-1);
    return [...lines, { line, start: last === undefined ? 0 : last.start + last.line.length + 1 }];
  }, []);

/** The label lines of the prose (code masked), keyed by the label as written, so one label is one kind across the document. */
const labelValues = (prose: string, units: ReadonlySet<string>): Measured[] =>
  linesWithStarts(prose).flatMap(({ line, start }) => {
    const found = labelLine(line, start);
    return found === undefined ? [] : measured(`label: ${found.label}`, found.label, found.value, found.at, units);
  });

/** Every number a table cell or label line gives, by kind. */
export const measuredValues = (source: string, prose: string, units: ReadonlySet<string>): Measured[] => [
  ...tablesOf(source).flatMap((table, index) => tableValues(source, table, index, units)),
  ...labelValues(prose, units),
];

/** Bare values must be fewer than those with the unit, so at least two carry it before a bare one reads as missing it. */
const gapsOfKind = (values: readonly Measured[]): UnitGap[] => {
  const withUnit = values.filter((value) => value.unit !== "");
  const bare = values.filter((value) => value.unit === "");
  const units = new Set(withUnit.map((value) => value.unit));
  const unit = [...units][0];
  if (unit === undefined || units.size !== 1 || bare.length >= withUnit.length) return [];
  return bare.map((value) => ({ value, unit }));
};

/** Bare numbers among values of one kind that otherwise all carry one unit, in document order. */
export const unitGaps = (values: readonly Measured[]): UnitGap[] => {
  const kinds = values.reduce((groups, value) => groups.set(value.kind, [...(groups.get(value.kind) ?? []), value]), new Map<string, Measured[]>());
  return [...kinds.values()].flatMap(gapsOfKind).toSorted((left, right) => left.value.offset - right.value.offset);
};

const unitsOf = (doc: ProseDocument): Set<string> =>
  new Set(UNIT_LEXICONS.flatMap((name) => (doc.lexicons[name] ?? []).flatMap((entry) => [entry.pattern, entry.pattern.toLowerCase()])));

export const numberWithoutUnit: Detector = (doc: ProseDocument): Finding[] =>
  unitGaps(measuredValues(doc.source, doc.prose ?? doc.source, unitsOf(doc))).map((gap) => ({
    rule: "number-without-unit",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, gap.value.offset),
    values: { value: gap.value.written, name: gap.value.name, unit: gap.unit, offset: gap.value.offset },
  }));
