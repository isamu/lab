import type { CrossDetector, DocumentFinding, ProseDocument, Span, StructureNode } from "../plugin.ts";
import { nameSpans } from "../compare/proper-nouns.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";
import { factValues } from "../facts/fact-values.ts";
import { labelledFacts, type Fact } from "../facts/labelled-facts.ts";
import { tableFacts } from "../facts/table-facts.ts";
import { emailSpans, versionSpans } from "../facts/address-values.ts";
import { scopedFacts, type ScopedFact } from "../facts/fact-scope.ts";
import { factsOutOfStep, writtenValue, type FactOutOfStep } from "../facts/cross-facts.ts";
import { factWordsOf } from "./fact-consistency.ts";
import { quoteAt } from "./structure-tree.ts";

// cross-doc-fact-conflict reads facts as fact-conflict does (fact-consistency.ts), with two more kinds of value that a docs
// site repeats from page to page: an email address and a version of three parts or more (2.4.1, v3).

/** The proper nouns, and the addresses and versions, read as values named by what they are. A name inside an address is the address. */
const namedValues = (doc: ProseDocument): Span[] => {
  const extra = [...emailSpans(doc.source), ...versionSpans(doc.source)];
  const taken = spanIndex(extra);
  return [...nameSpans(doc).filter((span) => !overlapsAny(taken, span)), ...extra];
};

const summaryHeadings = (doc: ProseDocument): string[] => (doc.lexicons["summary-heading"] ?? []).map((entry) => entry.pattern);

/** A colon right before the value, past emphasis marks: "Fee: $12", 「料金：1,200円」, "**Fee:** $12". */
const COLON_BEFORE = /[:：][\s*_]*$/u;

/**
 * A fact written as an entry: "Item: value", or a table cell. A fact in a sentence (「指摘は 3 件です」) is about what that
 * page is saying, and the same words on another page are often about something else; within one file, fact-conflict reads them.
 */
const isEntry = (source: string, fact: Fact): boolean => COLON_BEFORE.test(source.slice(source.lastIndexOf("\n", fact.value.start - 1) + 1, fact.value.start));

const factsOf = (doc: ProseDocument, tree: StructureNode): ScopedFact[] => {
  const values = factValues(tree, doc.source, namedValues(doc));
  const entries = labelledFacts(doc.source, values, factWordsOf(doc)).filter((fact) => isEntry(doc.source, fact));
  return scopedFacts([...entries, ...tableFacts(doc.source, values)], tree, doc.source, summaryHeadings(doc));
};

const findingOf = (byPath: ReadonlyMap<string, ProseDocument>, odd: FactOutOfStep): DocumentFinding[] => {
  const doc = byPath.get(odd.path);
  const usualDoc = byPath.get(odd.usual.path);
  if (doc === undefined || usualDoc === undefined) return [];
  const values = {
    label: odd.fact.label,
    value: writtenValue(doc.source, odd.fact.value),
    other: writtenValue(usualDoc.source, odd.usual.value.value),
    count: odd.files,
    example: odd.usual.path,
    offset: odd.fact.value.start,
  };
  return [{ path: odd.path, finding: { rule: "", severity: "warning", line: 0, column: 0, quote: quoteAt(doc.source, odd.fact.value.start), values } }];
};

/** A labelled fact given one value in some files of the run and another in the rest: reported in the files of the fewer value. */
export const crossDocFactConflict: CrossDetector = (docs) => {
  const files = docs.flatMap((doc) => (doc.structure === undefined ? [] : [{ path: doc.path, facts: factsOf(doc, doc.structure) }]));
  const byPath = new Map(docs.map((doc) => [doc.path, doc]));
  return factsOutOfStep(files).flatMap((odd) => findingOf(byPath, odd));
};
