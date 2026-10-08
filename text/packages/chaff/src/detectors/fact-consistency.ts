import type { Detector, Finding, ProseDocument, StructureNode } from "../plugin.ts";
import { countedFacts, countedPhraseAt, type CountedPhrase } from "../facts/counted-facts.ts";
import { nameSpans } from "../compare/proper-nouns.ts";
import { factValues, type FactValue } from "../facts/fact-values.ts";
import { labelledFacts, type AttributePhrase, type FactWords } from "../facts/labelled-facts.ts";
import { tableFacts } from "../facts/table-facts.ts";
import { partsAt, scopedFacts, type ScopedFact } from "../facts/fact-scope.ts";
import { conditionPairConflicts, type ChangeSentence, type ChangeWords, type ConditionWord, type PairConflict, type WordAt } from "../facts/condition-pairs.ts";
import { scopeConflicts, summaryConflicts, type FactConflict } from "../facts/fact-conflicts.ts";
import { eventDateConflicts, type EventDateConflict, type EventWord } from "../facts/event-dates.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

export const factWordsOf = (doc: ProseDocument): FactWords => ({
  separators: patternsOf(doc, "fact-separator"),
  valueEnds: patternsOf(doc, "fact-value-end"),
  determiners: patternsOf(doc, "fact-label-drop"),
  vague: patternsOf(doc, "fact-label-vague"),
  leads: patternsOf(doc, "fact-label-lead"),
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

const countedPhrasesOf = (doc: ProseDocument): CountedPhrase[] =>
  doc.sentences.flatMap((sentence) => {
    const tokens = sentence.tokens ?? [];
    return tokens.flatMap((token, index) => (token.pos === "NUM" ? countedPhraseAt(tokens, index) : []));
  });

/** The values named by what they count, scoped like the labelled ones. Only the summary is compared with them. */
const countedFactsOf = (doc: ProseDocument): ScopedFact[] => {
  const tree = doc.structure;
  if (tree === undefined) return [];
  const values = factValues(tree, doc.source, nameSpans(doc));
  return scopedFacts(countedFacts(doc.source, values, countedPhrasesOf(doc)), tree, doc.source, patternsOf(doc, "summary-heading"));
};

const wordsAt = (doc: ProseDocument, id: string): WordAt[] =>
  (doc.lexicons[id] ?? []).map((entry): WordAt => ({ pattern: entry.pattern, position: entry.position ?? "before" }));

const conditionsOf = (doc: ProseDocument, id: string): ConditionWord[] =>
  (doc.lexicons[id] ?? []).map((entry): ConditionWord => ({ pattern: entry.pattern, group: entry.group ?? entry.pattern }));

const changeWordsOf = (doc: ProseDocument): ChangeWords => ({
  from: wordsAt(doc, "fact-change-from"),
  to: wordsAt(doc, "fact-change-to"),
  notChange: patternsOf(doc, "fact-change-not"),
  subjectMarks: patternsOf(doc, "fact-change-subject-mark"),
  joiners: wordsAt(doc, "fact-name-joiner"),
  conditionsFrom: conditionsOf(doc, "fact-condition-from"),
  conditionsTo: conditionsOf(doc, "fact-condition-to"),
});

const changeSentencesOf = (doc: ProseDocument, tree: StructureNode): ChangeSentence[] => {
  const parts = partsAt(
    doc.sentences.map((sentence) => sentence.span.start),
    tree,
    patternsOf(doc, "summary-heading"),
  );
  return doc.sentences.map((sentence, index) => ({
    span: sentence.span,
    text: sentence.text,
    tokens: sentence.tokens ?? [],
    summary: parts[index] !== "body",
  }));
};

const ARROW = " → ";

const pairFinding =
  (doc: ProseDocument) =>
  ({ summary, body }: PairConflict): Finding => ({
    rule: "summary-fact-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, summary.from.start),
    values: {
      label: summary.subject,
      value: [shown(doc, summary.from), shown(doc, summary.to)].join(ARROW),
      other: [shown(doc, body.from), shown(doc, body.to)].join(ARROW),
      offset: summary.from.start,
    },
  });

/** 要約の「XからYに」が、本文が条件で分けて書いた同じ名前の二つの値と違う。 */
const conditionPairFindings = (doc: ProseDocument): Finding[] => {
  const tree = doc.structure;
  if (tree === undefined) return [];
  const values = factValues(tree, doc.source, nameSpans(doc));
  return conditionPairConflicts(doc.source, changeSentencesOf(doc, tree), values, changeWordsOf(doc)).map(pairFinding(doc));
};

const eventWordsOf = (doc: ProseDocument): EventWord[] =>
  (doc.lexicons["fact-event"] ?? []).map((entry): EventWord => ({ pattern: entry.pattern, group: entry.group ?? entry.pattern }));

const eventDateFinding =
  (doc: ProseDocument) =>
  ({ label, value, other }: EventDateConflict): Finding => ({
    rule: "summary-fact-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, value.start),
    values: { label, value: shown(doc, value), other: shown(doc, other), offset: value.start },
  });

/** 冒頭や要約の出来事の日付（11月9日から提供します）が、本文の同じ出来事の日付と違う。 */
const eventDateFindings = (doc: ProseDocument): Finding[] => {
  const tree = doc.structure;
  if (tree === undefined) return [];
  const values = factValues(tree, doc.source, nameSpans(doc));
  const dates = values.filter((value) => value.kind === "date");
  const names = values.filter((value) => value.kind === "name");
  const sentences = changeSentencesOf(doc, tree).map(({ span, text, summary }) => ({
    ...span,
    text,
    summary,
    names: names.filter((name) => span.start <= name.start && name.end <= span.end).map((name) => name.key),
  }));
  return eventDateConflicts(sentences, dates, eventWordsOf(doc)).map(eventDateFinding(doc));
};

/** 冒頭や要約の値が、本文の同じ名前の値と違う。 */
export const summaryFactMismatch: Detector = (doc): Finding[] => [
  ...summaryConflicts([...factsOf(doc), ...countedFactsOf(doc)]).map(findingOf("summary-fact-mismatch", doc)),
  ...conditionPairFindings(doc),
  ...eventDateFindings(doc),
];
