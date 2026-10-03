import type { CrossDetector, DocumentFinding, ProseDocument, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { definitionsOutOfStep, type DefinitionOutOfStep, type WrittenDefinition } from "../structure/cross-definitions.ts";
import { quoteAt } from "./structure-tree.ts";

// cross-doc-duplicate-definition reads definitions as duplicate-definition does (the tree's definition nodes), and compares
// what each file says after the term: 「X」とは、…をいう / "X" means ….

/**
 * A definition that stands alone: not one held within an article or section (scope local), and not the inline kind
 * (以下「X」という, ("X")), whose meaning is written before the term rather than after it.
 */
const standsAlone = (node: StructureNode): boolean =>
  node.kind === "definition" && node.attrs["scope"] !== "local" && node.attrs["placement"] !== "inline" && node.attrs["term"] !== undefined;

/** The language's words of a definition (をいう, means): the definition-statement word list. */
const statementWordsOf = (doc: ProseDocument): string[] => (doc.lexicons["definition-statement"] ?? []).map((entry) => entry.pattern);

/**
 * What the sentence says after the term, up to its end. Empty when the sentence has none of the words of a definition:
 * 「『AI が書いた』とは言いません」 names the term without defining it.
 */
const bodyAfter = (doc: ProseDocument, node: StructureNode, statementWords: readonly string[]): string => {
  const sentence = doc.sentences.find((candidate) => candidate.span.start <= node.span.start && node.span.start < candidate.span.end);
  if (sentence === undefined || node.span.end > sentence.span.end) return "";
  const text = doc.source.slice(sentence.span.start, sentence.span.end);
  return statementWords.some((word) => text.includes(word)) ? doc.source.slice(node.span.end, sentence.span.end) : "";
};

const definitionsOf = (doc: ProseDocument, tree: StructureNode): WrittenDefinition[] => {
  const statementWords = statementWordsOf(doc);
  return inDocumentOrder(tree)
    .filter(standsAlone)
    .map((node) => ({ term: String(node.attrs["term"]), body: bodyAfter(doc, node, statementWords), offset: node.span.start }));
};

const findingOf = (byPath: ReadonlyMap<string, ProseDocument>, odd: DefinitionOutOfStep): DocumentFinding[] => {
  const doc = byPath.get(odd.path);
  if (doc === undefined) return [];
  const values = { term: odd.definition.term, count: odd.files, example: odd.usual.path, offset: odd.definition.offset };
  return [{ path: odd.path, finding: { rule: "", severity: "warning", line: 0, column: 0, quote: quoteAt(doc.source, odd.definition.offset), values } }];
};

/** A term defined in other words than in most files of the run that define it: reported in the files of the fewer wording. */
export const crossDocDuplicateDefinition: CrossDetector = (docs) => {
  const files = docs.flatMap((doc) => (doc.structure === undefined ? [] : [{ path: doc.path, definitions: definitionsOf(doc, doc.structure) }]));
  const byPath = new Map(docs.map((doc) => [doc.path, doc]));
  return definitionsOutOfStep(files).flatMap((odd) => findingOf(byPath, odd));
};
