// ratio-mismatch: the reading half. Reads the tables (each row's label and cells) and the sentences (the words of lexicons
// ratio-label and ratio-term, and the structure tree's quantities in a currency or a percent unit) and leaves the deciding
// to structure/ratio.ts.
import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAt } from "./structure-tree.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import {
  proseValues,
  sentenceRatioMismatch,
  tableRatioMismatches,
  type AmountWords,
  type ProseQuantity,
  type LabelHit,
  type RatioIssue,
  type RatioWords,
  type TableRow,
} from "../structure/ratio.ts";

const RULE = "ratio-mismatch";
const LATIN = /^[A-Za-z]/u;
/** A ratio label's group names the two terms it divides: "operating-profit/sales". */
const GROUP_SEPARATOR = "/";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): RatioWords => ({
  labels: (doc.lexicons["ratio-label"] ?? []).flatMap((entry) => {
    const [numerator, denominator, ...rest] = (entry.group ?? "").split(GROUP_SEPARATOR);
    return numerator === undefined || denominator === undefined || rest.length > 0 ? [] : [{ pattern: entry.pattern, numerator, denominator }];
  }),
  terms: (doc.lexicons["ratio-term"] ?? []).flatMap((entry) => (entry.group === undefined ? [] : [{ pattern: entry.pattern, term: entry.group }])),
  percentUnits: patternsOf(doc, "percent-unit"),
});

const currencyMarks = (doc: ProseDocument, position: "before" | "after"): string[] =>
  (doc.lexicons["currency-notation"] ?? []).filter((entry) => entry.position === position).map((entry) => entry.pattern);

const amountWordsOf = (doc: ProseDocument, percentUnits: readonly string[]): AmountWords => ({
  before: currencyMarks(doc, "before"),
  after: currencyMarks(doc, "after"),
  multipliers: patternsOf(doc, "amount-multiplier"),
  percentUnits,
});

/** A table line read as its label (the first cell) and the cells after it, each without its edge marks. */
export const tableRowOf = (row: Line): TableRow[] => {
  const [first, ...rest] = cellsOf(row);
  if (first === undefined) return [];
  const cells = rest.map((cell) => {
    const text = withoutEdgeMarks(cell.text);
    return { start: cell.start + Math.max(0, cell.text.indexOf(text)), text };
  });
  return [{ label: withoutEdgeMarks(first.text), cells }];
};

const tableRowsOf = (source: string): TableRow[][] => tablesOf(linesOf(source)).map((table) => table.rows.flatMap(tableRowOf));

/** A kanji or katakana next to a word written in them makes it part of a longer word (営業利益率 in 調整後営業利益率). */
const CJK_LETTER = /[\p{sc=Han}\p{sc=Katakana}ー]/u;

/** Where a word stands in the text: a Latin word as a whole word in any case, any other word not inside a longer one. */
const spansOf = (text: string, offset: number, word: string): Span[] => {
  const latin = LATIN.test(word);
  const pattern = latin ? new RegExp(`\\b${escapeRegExp(word)}\\b`, "giu") : new RegExp(escapeRegExp(word), "gu");
  return [...text.matchAll(pattern)]
    .filter((match) => latin || !(CJK_LETTER.test(text.charAt(match.index - 1)) || CJK_LETTER.test(text.charAt(match.index + match[0].length))))
    .map((match) => ({ start: offset + match.index, end: offset + match.index + match[0].length }));
};

/** A word inside a longer one is not a word of its own (営業利益 in 営業利益率, sales in net sales). */
const longestHits = (hits: readonly LabelHit[]): LabelHit[] =>
  hits.filter(
    (hit) => !hits.some((other) => other !== hit && other.start <= hit.start && hit.end <= other.end && other.end - other.start > hit.end - hit.start),
  );

const hitsIn = (text: string, offset: number, words: RatioWords): LabelHit[] => {
  const labels = words.labels.flatMap((label) => spansOf(text, offset, label.pattern).map((at) => ({ ...at, label })));
  const terms = words.terms.flatMap((term) => spansOf(text, offset, term.pattern).map((at) => ({ ...at, term: term.term })));
  return longestHits([...labels, ...terms]);
};

const quantitiesOf = (doc: ProseDocument): ProseQuantity[] =>
  doc.structure === undefined
    ? []
    : inDocumentOrder(doc.structure).flatMap((node) =>
        node.kind === "quantity" ? [{ start: node.span.start, end: node.span.end, unit: String(node.attrs["unit"] ?? "") }] : [],
      );

const proseIssues = (doc: ProseDocument, words: RatioWords): RatioIssue[] => {
  const named = doc.sentences.flatMap((sentence) => {
    const text = doc.source.slice(sentence.span.start, sentence.span.end);
    const hits = hitsIn(text, sentence.span.start, words);
    return hits.some((hit) => "label" in hit) ? [{ span: sentence.span, text, hits }] : [];
  });
  if (named.length === 0) return [];
  const amountWords = amountWordsOf(doc, words.percentUnits);
  const quantities = quantitiesOf(doc);
  return named.flatMap(({ span, text, hits }) => {
    const issue = sentenceRatioMismatch({ hits, end: span.end, ...proseValues(text, span.start, quantities, amountWords) });
    return issue === undefined ? [] : [issue];
  });
};

export const ratioMismatch: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (words.labels.length === 0) return [];
  const tables = tableRowsOf(proseAndTablesOf(doc)).flatMap((rows) => tableRatioMismatches(rows, words));
  const prose = proseIssues(doc, words).filter((issue) => !tables.some((table) => table.offset === issue.offset));
  return [...tables, ...prose]
    .toSorted((left, right) => left.offset - right.offset)
    .map((issue) => ({
      rule: RULE,
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, issue.offset),
      values: { ...issue.values, offset: issue.offset },
    }));
};
