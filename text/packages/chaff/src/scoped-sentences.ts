import type { ProseDocument, ScopedSentence, ScopeSelector, Sentence, TableCell } from "./plugin.ts";
import { inScope, scopesOf, type ScopeRegions } from "./text-scope.ts";

/**
 * What a rule limited to some parts of a document (scope:) reads from: the body's sentences, the sentences of the headings
 * and of the quotations (which the body leaves out), the table cells, and where the list items and quotations are.
 */
type ScopeSources = {
  readonly body: readonly Sentence[];
  readonly headings: readonly Sentence[];
  readonly quoted: readonly Sentence[];
  readonly cells: readonly TableCell[];
  readonly regions: ScopeRegions;
};

/** A table cell read as one sentence: a cell has no sentence ending to split at. */
const cellSentence = (cell: TableCell): Sentence => ({
  span: { start: cell.start, end: cell.end },
  text: cell.text,
  ...(cell.tokens === undefined ? {} : { tokens: cell.tokens }),
});

/** Every sentence a scope can choose from, in the order of the document, with the parts it is in. */
export const scopedSentences = (sources: ScopeSources): ScopedSentence[] =>
  [
    ...sources.body.map((sentence) => ({ sentence, scopes: scopesOf(sentence.span, sources.regions) })),
    ...sources.quoted.map((sentence) => ({ sentence, scopes: scopesOf(sentence.span, sources.regions) })),
    ...sources.headings.map((sentence) => ({ sentence, scopes: scopesOf(sentence.span, sources.regions, "heading") })),
    ...sources.cells.map((cell) => ({ sentence: cellSentence(cell), scopes: scopesOf(cell, sources.regions, "table") })),
  ].toSorted((left, right) => left.sentence.span.start - right.sentence.span.start);

/** A document built without its scoped sentences (a test's, a plugin's): the body alone, list items and reply quotes found in it. */
const bodyOnly = (doc: ProseDocument): ScopedSentence[] =>
  scopedSentences({ body: doc.sentences, headings: [], quoted: [], cells: [], regions: { list: doc.listSpans, quote: doc.replyQuotes ?? [] } });

/** Every sentence of the document with the parts it is in. */
export const scopedSentencesOf = (doc: ProseDocument): readonly ScopedSentence[] => doc.scopedSentences?.() ?? bodyOnly(doc);

/** The sentences a rule with this scope reads. Without a scope, the body's sentences, as every rule has always read. */
export const sentencesInScope = (doc: ProseDocument, scope: ScopeSelector | undefined): readonly Sentence[] =>
  scope === undefined ? doc.sentences : scopedSentencesOf(doc).flatMap((scoped) => (inScope(scope, scoped.scopes) ? [scoped.sentence] : []));
