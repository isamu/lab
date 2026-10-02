import type { Detector, Finding, ProseDocument, StructureNode } from "../plugin.ts";
import { nameSpans } from "../compare/proper-nouns.ts";
import { factValues, type FactValue } from "../facts/fact-values.ts";
import { labelledFacts, type AttributePhrase, type FactWords } from "../facts/labelled-facts.ts";
import { tableFacts } from "../facts/table-facts.ts";
import { scopedFacts, type ScopedFact } from "../facts/fact-scope.ts";
import { scopeConflicts, summaryConflicts, type FactConflict } from "../facts/fact-conflicts.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

export const factWordsOf = (doc: ProseDocument): FactWords => ({
  separators: patternsOf(doc, "fact-separator"),
  valueEnds: patternsOf(doc, "fact-value-end"),
  determiners: patternsOf(doc, "fact-label-drop"),
  vague: patternsOf(doc, "fact-label-vague"),
  attributes: (doc.lexicons["fact-attribute"] ?? []).map((entry): AttributePhrase => ({ pattern: entry.pattern, position: entry.position ?? "before" })),
});

const factsByDocument = new WeakMap<ProseDocument, readonly ScopedFact[]>();

const readFacts = (doc: ProseDocument, tree: StructureNode): ScopedFact[] => {
  const values = factValues(tree, doc.source, nameSpans(doc));
  const facts = [...labelledFacts(doc.source, values, factWordsOf(doc)), ...tableFacts(doc.source, values)];
  return scopedFacts(facts, tree, doc.source, patternsOf(doc, "summary-heading"));
};

/** 文書の名前付きの値。二つの rule が読むので、文書ごとに一度だけ読む。 */
const factsOf = (doc: ProseDocument): readonly ScopedFact[] => {
  const cached = factsByDocument.get(doc);
  if (cached !== undefined) return cached;
  const facts = doc.structure === undefined ? [] : readFacts(doc, doc.structure);
  factsByDocument.set(doc, facts);
  return facts;
};

const shown = (doc: ProseDocument, value: FactValue): string => doc.source.slice(value.start, value.end);

const findingOf =
  (rule: string, doc: ProseDocument) =>
  (conflict: FactConflict): Finding => ({
    rule,
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, conflict.fact.value.start),
    values: { label: conflict.fact.label, value: shown(doc, conflict.fact.value), other: shown(doc, conflict.other), offset: conflict.fact.value.start },
  });

/** 同じ節で、同じ名前に二通りの値（締切：10月5日 と 締切：10月7日）。 */
export const factConflict: Detector = (doc): Finding[] => scopeConflicts(factsOf(doc)).map(findingOf("fact-conflict", doc));

/** 冒頭や要約の値が、本文の同じ名前の値と違う。 */
export const summaryFactMismatch: Detector = (doc): Finding[] => summaryConflicts(factsOf(doc)).map(findingOf("summary-fact-mismatch", doc));
