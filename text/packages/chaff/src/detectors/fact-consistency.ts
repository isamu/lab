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
import { retentionConflicts, type LengthMark, type RetentionLength, type RetentionVerb, type RetentionWords } from "../facts/retention-periods.ts";
import type { DurationUnit } from "../derived/date-arithmetic.ts";
import { DURATION_LEXICONS, quantitiesOf, type Quantity } from "./derived-numbers.ts";
import { quoteAt } from "./structure-tree.ts";
import { measuredOf, valuesWith } from "./measured-facts.ts";
import { durationValues, type DurationWord } from "../facts/duration-values.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";

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

const durationWordsOf = (doc: ProseDocument): DurationWord[] =>
  DURATION_LEXICONS.flatMap(([id, unit]) => patternsOf(doc, id).map((pattern): DurationWord => ({ pattern, unit })));

/**
 * 単位の語彙表の量（410 g、1.2 kg）と期間（3 months）も値として読む。木が単位を読まない量は、数だけでは升や文の値にならない。
 * 期間と重なる量は読まない（3 months の 3 m）。
 */
const readFacts = (doc: ProseDocument, tree: StructureNode): ScopedFact[] => {
  const durations = durationValues(doc.source, factValues(tree, doc.source, nameSpans(doc)), durationWordsOf(doc));
  const taken = spanIndex(durations);
  const values = valuesWith(tree, doc, [...measuredOf(doc).filter((value) => !overlapsAny(taken, value)), ...durations]);
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

const UNITS: readonly DurationUnit[] = ["day", "week", "month", "year"];

const isDurationUnit = (group: string | undefined): group is DurationUnit => UNITS.some((unit) => unit === group);

const retentionUnitOf = (doc: ProseDocument, unit: string): DurationUnit | undefined => {
  const listed = DURATION_LEXICONS.find(([id]) => patternsOf(doc, id).some((pattern) => pattern.normalize("NFKC") === unit))?.[1];
  const extra = (doc.lexicons["retention-unit"] ?? []).find((entry) => entry.pattern.normalize("NFKC") === unit)?.group;
  return listed ?? (isDurationUnit(extra) ? extra : undefined);
};

/** 単位の語彙表に、書いた単位より長い形（か月 に対する か月間）があれば、そこまで。木の数量は か月 で終わる。 */
const endWithLongerUnit = (doc: ProseDocument, quantity: Quantity): number => {
  const unitStart = quantity.end - quantity.unit.length;
  const longer = DURATION_LEXICONS.flatMap(([id]) => patternsOf(doc, id))
    .filter((pattern) => pattern.length > quantity.unit.length && pattern.startsWith(quantity.unit) && doc.source.startsWith(pattern, unitStart))
    .reduce((longest, pattern) => Math.max(longest, pattern.length), quantity.unit.length);
  return unitStart + longer;
};

const retentionLengthsOf = (doc: ProseDocument, tree: StructureNode): RetentionLength[] =>
  quantitiesOf(tree, doc.source).flatMap((quantity) => {
    const unit = retentionUnitOf(doc, quantity.unit);
    return unit === undefined ? [] : [{ start: quantity.start, end: endWithLongerUnit(doc, quantity), amount: quantity.amount, unit }];
  });

const retentionVerbsOf = (doc: ProseDocument): RetentionVerb[] =>
  (doc.lexicons["retention-verb"] ?? []).map((entry) => ({ pattern: entry.pattern, group: entry.group ?? "", position: entry.position ?? "before" }));

const lengthMarksOf = (doc: ProseDocument): LengthMark[] =>
  (doc.lexicons["retention-length-mark"] ?? []).map((entry) => ({ pattern: entry.pattern, group: entry.group ?? "", position: entry.position ?? "before" }));

const retentionWordsOf = (doc: ProseDocument): RetentionWords => ({
  verbs: retentionVerbsOf(doc),
  marks: lengthMarksOf(doc),
  modifiers: patternsOf(doc, "retention-length-modifier"),
  bounds: [...wordsAt(doc, "approximate-marker"), ...wordsAt(doc, "retention-bound")],
  joiners: patternsOf(doc, "fact-name-joiner"),
  objectMarks: patternsOf(doc, "retention-object-mark"),
});

/** 文書のどこかで、同じものの保存期間が二通り（1年間保存 と 3年間を経過したら削除）。 */
const retentionFindings = (doc: ProseDocument): Finding[] => {
  const tree = doc.structure;
  if (tree === undefined) return [];
  const sentences = doc.sentences.map((sentence) => ({ ...sentence.span, tokens: sentence.tokens ?? [] }));
  return retentionConflicts(doc.source, sentences, retentionLengthsOf(doc, tree), retentionWordsOf(doc)).map(({ object, value, other }): Finding => ({
    rule: "fact-conflict",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, value.start),
    variant: "retention",
    values: { label: object, value: doc.source.slice(value.start, value.end), other: doc.source.slice(other.start, other.end), offset: value.start },
  }));
};

/** 同じ節で、同じ名前に二通りの値（締切：10月5日 と 締切：10月7日）。文書のどこでも、同じものに二通りの保存期間。 */
export const factConflict: Detector = (doc): Finding[] => [...scopeConflicts(factsOf(doc)).map(findingOf("fact-conflict", doc)), ...retentionFindings(doc)];

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
