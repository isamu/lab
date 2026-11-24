// The scoped reading of a document: its headings and quotations read into sentences, besides the body and the table
// cells, for a rule with a scope.
import { maskSpans } from "./mask.ts";
import { unmaskedSoftBreaks } from "./soft-break.ts";
import { eachPreOrder } from "./tree-walk.ts";
import { alertReader } from "./template-syntax.ts";
import { spansOfType } from "./markdown-read.ts";
import { spanOf, type MarkdownNode as Node } from "./markdown-node.ts";
import { scopedSentences } from "./scoped-sentences.ts";
import { headingMarkers, quoteMarkers } from "./scope-markers.ts";
import { proseOf, sentencesOf, shift, startsInside } from "./document-prose.ts";
import type { LanguageAdapter, ProseDocument, ScopedSentence, Sentence, Span } from "./plugin.ts";

/**
 * The quotations a rule with a scope reads as quote: each outermost `>` block, not a GitHub alert (the writer's own text
 * in a box, read as body text). A quotation inside an alert is quoted.
 */
const quotationsOf = (root: Node, source: string): Span[] => {
  const alertOf = alertReader(source);
  const found: Span[] = [];
  eachPreOrder(root, (node) => {
    if (node.type !== "blockquote" || alertOf(node) !== undefined) return;
    const span = spanOf(node);
    if (span !== undefined && !startsInside(span, found)) found.push(span);
  });
  return found;
};

const shiftedBy =
  (by: number) =>
  (span: Span): Span =>
    shift(span, by);

/** What the scoped reading needs from the document being built. masks: what is not text, headings and quotations left readable. */
type ScopeInput = {
  readonly root: Node;
  readonly source: string;
  readonly markdown: boolean;
  readonly masks: readonly Span[];
  readonly adapter: LanguageAdapter;
  readonly doc: () => ProseDocument;
};

/** The headings and the quotations, read into sentences with their marks blanked, besides the body and the table cells. */
export const scopedReadingOf = (input: ScopeInput): ScopedSentence[] => {
  const { root, source, doc } = input;
  const quotes = quotationsOf(root, source);
  const quoteMarks = quotes.flatMap((quote) => quoteMarkers(source.slice(quote.start, quote.end)).map(shiftedBy(quote.start)));
  const unquoted = maskSpans(source, quoteMarks);
  const headings = spansOfType(root, "heading");
  const headingMarks = headings.flatMap((heading) => headingMarkers(unquoted.slice(heading.start, heading.end)).map(shiftedBy(heading.start)));
  const prose = proseOf(source, [...input.masks, ...quoteMarks, ...headingMarks]);
  const softBreaks = input.markdown ? unmaskedSoftBreaks(source, prose) : [];
  const read = (spans: readonly Span[]): Sentence[] => sentencesOf(prose, spans, input.adapter, softBreaks);
  const quoted = spansOfType(root, "paragraph").filter((paragraph) => startsInside(paragraph, quotes));
  const { sentences, listSpans, replyQuotes, tableCells } = doc();
  return scopedSentences({
    body: sentences,
    headings: read(headings),
    quoted: read(quoted),
    cells: tableCells?.() ?? [],
    regions: { list: listSpans, quote: [...quotes, ...(replyQuotes ?? [])] },
  });
};

export const KEPT_FOR_SCOPE: ReadonlySet<string> = new Set(["heading", "blockquote"]);
