import type { Finding, ProseDocument, StructureNode } from "../plugin.ts";
import { nameSpans } from "../compare/proper-nouns.ts";
import { factValues, type FactValue } from "../facts/fact-values.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { scopedFacts, type ScopedFact } from "../facts/fact-scope.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import {
  periodOf,
  rowSentenceConflicts,
  type Amount,
  type AmountRow,
  type PeriodMark,
  type SubjectSentence,
  type SubjectWords,
} from "../facts/row-sentence-amounts.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { quoteAt } from "./structure-tree.ts";

const LETTER = /\p{L}/u;

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const within = <T extends FactValue>(span: { start: number; end: number }, values: readonly T[]): T[] =>
  values.filter((value) => span.start <= value.start && value.end <= span.end);

/** 範囲は事実と同じ読み（fact-scope）。値の位置で決まる。位置ごとの範囲。 */
const scopesAt = (doc: ProseDocument, tree: StructureNode, values: readonly FactValue[]): ReadonlyMap<number, string> =>
  new Map(
    scopedFacts(
      values.map((value) => ({ label: "", key: "", value })),
      tree,
      doc.source,
      patternsOf(doc, "summary-heading"),
    ).map((fact) => [fact.value.start, fact.scope]),
  );

const amountRow = (row: Line, amounts: readonly Amount[], scopes: ReadonlyMap<number, string>): AmountRow[] => {
  const [first, ...rest] = cellsOf(row);
  if (first === undefined) return [];
  const label = withoutEdgeMarks(first.text);
  const inRow = rest.flatMap((cell) => within(cell, amounts));
  const [head] = inRow;
  if (head === undefined || !LETTER.test(label) || within(first, amounts).length > 0) return [];
  return [{ label, scope: scopes.get(head.start) ?? "", amounts: inRow }];
};

const subjectSentences = (doc: ProseDocument, amounts: readonly Amount[], scopes: ReadonlyMap<number, string>): SubjectSentence[] =>
  doc.sentences.flatMap((sentence) => {
    const inSentence = within(sentence.span, amounts);
    const [head] = inSentence;
    return head === undefined ? [] : [{ text: sentence.text, scope: scopes.get(head.start) ?? "", amounts: inSentence }];
  });

const subjectWordsOf = (doc: ProseDocument): SubjectWords => ({
  separators: patternsOf(doc, "fact-separator"),
  determiners: patternsOf(doc, "fact-label-drop"),
  conditions: patternsOf(doc, "fact-amount-condition"),
});

const periodMarksOf = (doc: ProseDocument): PeriodMark[] =>
  (doc.lexicons["per-unit-mark"] ?? []).map((entry): PeriodMark => ({ pattern: entry.pattern, group: entry.group ?? entry.pattern }));

/** 金額: 通貨の語彙表の印を単位に書いた数量。前後に期間あたりの印があれば、その期間も。 */
const amountsOf = (doc: ProseDocument, tree: StructureNode): Amount[] => {
  const currencies = new Set(patternsOf(doc, "currency-notation").map((pattern) => pattern.normalize("NFKC")));
  const marks = periodMarksOf(doc);
  return factValues(tree, doc.source, nameSpans(doc))
    .filter((value) => value.kind === "quantity" && currencies.has(value.unit))
    .map((value): Amount => {
      const period = periodOf(doc.source, value, marks);
      return period === undefined ? value : { ...value, period };
    });
};

/** 表の行の金額と、その行の見出しを主語にした文の金額の食い違い。名前付きの値として読めた文の値は、ほかの読みが比べる。 */
export const rowSentenceFindings = (doc: ProseDocument, facts: readonly ScopedFact[]): Finding[] => {
  const tree = doc.structure;
  if (tree === undefined) return [];
  const amounts = amountsOf(doc, tree);
  const tableRows = tablesOf(linesOf(doc.source)).flatMap((table) => table.rows);
  if (tableRows.length === 0 || amounts.length === 0) return [];
  const scopes = scopesAt(doc, tree, amounts);
  const rows = tableRows.flatMap((row) => amountRow(row, amounts, scopes));
  const read = new Set(facts.map((fact) => fact.value.start));
  return rowSentenceConflicts(rows, subjectSentences(doc, amounts, scopes), subjectWordsOf(doc))
    .filter((conflict) => !read.has(conflict.value.start))
    .map(({ label, value, other }) => ({
      rule: "fact-conflict",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, value.start),
      variant: "term",
      values: { label, value: doc.source.slice(value.start, value.end), other: doc.source.slice(other.start, other.end), offset: value.start },
    }));
};
