// A forecast said to be revised one way (上方修正, revised upward) whose revision table moves the other way: a table with a
// column of the previous forecast and one of the revised forecast (or a row of each), and a word of revision in the same
// section. Pure; the detector passes the text, the sections, the sentences and the words of its lexicons.
import type { Span } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { escapeRegExp } from "../orthography.ts";

export type RevisionWords = {
  /** Words that say the forecast was revised upward (上方修正, revised upward) and downward (下方修正, lowered). */
  readonly rises: readonly string[];
  readonly falls: readonly string[];
  /** Verbs that say so only with a word of forecast in their sentence ("raised the forecast", not "raised funds"). */
  readonly risesWithObject: readonly string[];
  readonly fallsWithObject: readonly string[];
  /** Words of forecast (予想, forecast, guidance). */
  readonly objects: readonly string[];
  /** Labels of the previous forecast's column or row (前回発表予想, Previous forecast) and of the revised one's. */
  readonly previous: readonly string[];
  readonly revised: readonly string[];
};

export type RevisionText = {
  readonly text: string;
  /** Where each section starts (its heading). The text before the first is a section of its own. */
  readonly sectionStarts: readonly number[];
  /** The sentences and headings a word of revision is read in, for the rows it names. */
  readonly units: readonly Span[];
};

type Table = { readonly header: Line; readonly rows: readonly Line[] };
/** One item of a revision table: its label, and its previous and revised cells. */
export type RevisionItem = { readonly label: string; readonly previous: Cell; readonly revised: Cell };
type Hit = Span & { readonly sign: 1 | -1 };
type Signed = { readonly word: string; readonly sign: 1 | -1; readonly needsObject: boolean };

const LATIN = /^[A-Za-z]/u;
const LETTER = /\p{L}/u;
const NEGATIVE = /^[-−▲△]/u;
const CURRENCY = /^[$€£¥]/u;
const NUMBER = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/u;
/** What may follow the number: a unit (百万円, million), never another number or a range ("5,200〜5,400"). */
const UNIT = /^[^\d.,]*$/u;
const RISE: 1 | -1 = 1;
const FALL: 1 | -1 = -1;

/** The text with a leading match of the pattern taken off, and what was taken ("" when none). */
const takeLeading = (text: string, pattern: RegExp): readonly [string, string] => {
  const taken = pattern.exec(text)?.[0] ?? "";
  return [taken, text.slice(taken.length).trimStart()];
};

/** Where a word stands: a Latin word as a whole word, case aside; anything else as written. */
export const spansOf = (text: string, word: string): Span[] => {
  const pattern = LATIN.test(word) ? new RegExp(`\\b${escapeRegExp(word)}\\b`, "giu") : new RegExp(escapeRegExp(word), "gu");
  return [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
};

const mentions = (text: string, words: readonly string[]): boolean => words.some((word) => spansOf(text, word).length > 0);

/** A cell's number with the unit written around it ("5,200", "△120", "$5,200 million"); undefined when it is anything else. */
export const amountOf = (cell: string): { readonly value: number; readonly unit: string } | undefined => {
  const [sign, unsigned] = takeLeading(withoutEdgeMarks(cell).normalize("NFKC"), NEGATIVE);
  const [currency, priced] = takeLeading(unsigned, CURRENCY);
  const [digits, rest] = takeLeading(priced, NUMBER);
  if (digits === "" || !UNIT.test(rest)) return undefined;
  const magnitude = Number(digits.replaceAll(",", ""));
  return { value: sign === "" ? magnitude : -magnitude, unit: [currency, rest.trim()].join("|") };
};

/** Which way an item moved: 1 up, -1 down; undefined when a cell is not a number, the units differ, or nothing moved. */
export const moveOf = (item: RevisionItem): 1 | -1 | undefined => {
  const [previous, revised] = [amountOf(item.previous.text), amountOf(item.revised.text)];
  if (previous === undefined || revised === undefined || previous.unit !== revised.unit || previous.value === revised.value) return undefined;
  return revised.value > previous.value ? 1 : -1;
};

/** The one index whose label is of the group and not of the other ("前回予想" is previous, "今回予想" revised). */
const onlyIndex = (labels: readonly string[], group: readonly string[], other: readonly string[]): number | undefined => {
  const indices = labels.flatMap((label, index) => (mentions(label, group) && !mentions(label, other) ? [index] : []));
  return indices.length === 1 ? indices[0] : undefined;
};

const labelOf = (cell: Cell | undefined): string => withoutEdgeMarks(cell?.text ?? "");

/** Items in rows, the previous and revised forecasts in columns (| 項目 | 前回予想 | 今回予想 |). */
const itemsByRow = (header: readonly Cell[], rows: readonly Cell[][], words: RevisionWords): RevisionItem[] | undefined => {
  const labels = header.map((cell) => labelOf(cell));
  const [previous, revised] = [onlyIndex(labels, words.previous, words.revised), onlyIndex(labels, words.revised, words.previous)];
  if (previous === undefined || revised === undefined || previous === 0 || revised === 0) return undefined;
  return rows.flatMap((row) => {
    const [label, before, after] = [labelOf(row[0]), row[previous], row[revised]];
    return LETTER.test(label) && before !== undefined && after !== undefined ? [{ label, previous: before, revised: after }] : [];
  });
};

/** Items in columns, the previous and revised forecasts in rows (| | 売上高 | 営業利益 | with a row 前回発表予想（A）). */
const itemsByColumn = (header: readonly Cell[], rows: readonly Cell[][], words: RevisionWords): RevisionItem[] | undefined => {
  const labels = rows.map((row) => labelOf(row[0]));
  const [previous, revised] = [onlyIndex(labels, words.previous, words.revised), onlyIndex(labels, words.revised, words.previous)];
  if (previous === undefined || revised === undefined) return undefined;
  return header.slice(1).flatMap((cell, index) => {
    const [label, before, after] = [labelOf(cell), rows[previous]?.[index + 1], rows[revised]?.[index + 1]];
    return LETTER.test(label) && before !== undefined && after !== undefined ? [{ label, previous: before, revised: after }] : [];
  });
};

/** The items of a revision table, in the order written; undefined when the table is not one. */
export const revisionItems = (table: Table, words: RevisionWords): RevisionItem[] | undefined => {
  const header = cellsOf(table.header);
  const rows = table.rows.map((row) => cellsOf(row));
  return itemsByRow(header, rows, words) ?? itemsByColumn(header, rows, words);
};

const sectionOf = (offset: number, starts: readonly number[], length: number): Span => {
  const start = starts.filter((at) => at <= offset).reduce((latest, at) => Math.max(latest, at), 0);
  const end = starts.filter((at) => at > offset).reduce((earliest, at) => Math.min(earliest, at), length);
  return { start, end };
};

const tableSpan = (table: Table): Span => {
  const last = table.rows.at(-1) ?? table.header;
  return { start: table.header.start, end: last.start + last.text.length };
};

const within = (outer: Span, inner: Span): boolean => inner.start >= outer.start && inner.end <= outer.end;

const signedWords = (words: RevisionWords): Signed[] => [
  ...words.rises.map((word) => ({ word, sign: RISE, needsObject: false })),
  ...words.falls.map((word) => ({ word, sign: FALL, needsObject: false })),
  ...words.risesWithObject.map((word) => ({ word, sign: RISE, needsObject: true })),
  ...words.fallsWithObject.map((word) => ({ word, sign: FALL, needsObject: true })),
];

/** The words of revision in the section, outside its tables; a verb that needs a word of forecast, with one in its sentence. */
const hitsIn = (input: RevisionText, section: Span, tables: readonly Span[], words: RevisionWords): Hit[] => {
  const text = input.text.slice(section.start, section.end);
  return signedWords(words).flatMap(({ word, sign, needsObject }) =>
    spansOf(text, word)
      .map((span) => ({ start: span.start + section.start, end: span.end + section.start, sign }))
      .filter((hit) => !tables.some((table) => within(table, hit)))
      .filter((hit) => !needsObject || mentions(unitTextOf(input, hit), words.objects)),
  );
};

/** A word revises upward inside a phrase that revises downward ("下方修正" holds no "上方修正", but "revised downward" might). */
const outermost = (hits: readonly Hit[]): Hit[] =>
  hits.filter((hit) => !hits.some((other) => other !== hit && within(other, hit) && other.end - other.start > hit.end - hit.start));

/** The text of the sentence or heading a word stands in, else of its line. */
const unitTextOf = (input: RevisionText, hit: Span): string => {
  const unit = input.units.find((span) => within(span, hit));
  if (unit !== undefined) return input.text.slice(unit.start, unit.end);
  const line = linesOf(input.text).find((candidate) => candidate.start <= hit.start && hit.start <= candidate.start + candidate.text.length);
  return line?.text ?? input.text.slice(hit.start, hit.end);
};

const OPENING_BRACKET = /[（(]/u;

/** A label as a sentence names it: as written, or without the brackets it ends with ("Operating profit (loss)", 「売上高（百万円）」). */
export const namesItem = (sentence: string, label: string): boolean => {
  const core = (label.split(OPENING_BRACKET)[0] ?? "").trim();
  return [label, core].some((name) => LETTER.test(name) && spansOf(sentence, name).length > 0);
};

/** The items the sentences of the words name; with none named, the first item, the headline figure. */
const checkedItems = (input: RevisionText, hits: readonly Hit[], items: readonly RevisionItem[]): RevisionItem[] => {
  const units = hits.map((hit) => unitTextOf(input, hit));
  const named = items.filter((item) => units.some((unit) => namesItem(unit, item.label)));
  if (named.length > 0) return named;
  return items.slice(0, 1);
};

const issueOf = (item: RevisionItem, hit: Hit, input: RevisionText): StructureIssue => {
  const lead = item.revised.text.length - item.revised.text.trimStart().length;
  return {
    offset: item.revised.start + lead,
    values: {
      word: input.text.slice(hit.start, hit.end),
      item: item.label,
      previous: withoutEdgeMarks(item.previous.text),
      revised: withoutEdgeMarks(item.revised.text),
    },
  };
};

/**
 * One revision table's mismatches. The words of the section must agree on one direction; the items checked must agree on
 * one move (named items that moved both ways are about different words), and that move must be the other way.
 */
const tableIssues = (input: RevisionText, table: Table, tables: readonly Span[], words: RevisionWords): StructureIssue[] => {
  const items = revisionItems(table, words);
  const section = sectionOf(table.header.start, input.sectionStarts, input.text.length);
  const hits = outermost(hitsIn(input, section, tables, words));
  const signs = new Set(hits.map((hit) => hit.sign));
  const [hit] = hits;
  if (items === undefined || hit === undefined || signs.size !== 1) return [];
  const checked = checkedItems(input, hits, items).flatMap((item) => {
    const move = moveOf(item);
    return move === undefined ? [] : [{ item, move }];
  });
  const moves = new Set(checked.map(({ move }) => move));
  if (moves.size !== 1 || moves.has(hit.sign)) return [];
  return checked.map(({ item }) => issueOf(item, hit, input));
};

/** Each revision table whose items move against the word of revision written in its section. */
export const revisionDirectionMismatches = (input: RevisionText, words: RevisionWords): StructureIssue[] => {
  const tables = tablesOf(linesOf(input.text));
  const spans = tables.map((table) => tableSpan(table));
  return tables.flatMap((table) => tableIssues(input, table, spans, words));
};
