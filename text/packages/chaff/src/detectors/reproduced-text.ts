import type { Paragraph, Span, StructureNode } from "../plugin.ts";
import { articlesInCitedDocuments } from "../structure/cited-document-section.ts";

// Text the writer reproduces from another document, word for word: the articles of a statute copied under a heading that
// names it (### …に関する法律 / 第7条 …), and a paragraph after a lead-in that says it is reproduced (The entire receipt
// reads as follows:). Its sentences are the source's, not the writer's to shorten. Pure.

/** A lead-in closes its paragraph with a colon. */
const ENDS_WITH_COLON = /[:：]\s*$/u;

const isVerbatimLead = (text: string, leads: readonly string[]): boolean =>
  ENDS_WITH_COLON.test(text) && leads.some((lead) => text.toLowerCase().includes(lead.toLowerCase()));

/** The paragraphs right after a lead-in that says the next text is reproduced (reads as follows:, 次のように規定している：). */
const afterVerbatimLeads = (paragraphs: readonly Paragraph[], source: string, leads: readonly string[]): Span[] =>
  paragraphs.flatMap((paragraph, at) => {
    const next = paragraphs[at + 1];
    return next !== undefined && isVerbatimLead(source.slice(paragraph.span.start, paragraph.span.end), leads) ? [next.span] : [];
  });

/** The spans of reproduced text: copied articles of a cited statute, and the paragraph after a verbatim lead-in. */
export const reproducedSpans = (
  structure: StructureNode | undefined,
  paragraphs: readonly Paragraph[],
  source: string,
  leads: readonly string[],
): readonly Span[] => [
  ...(structure === undefined ? [] : articlesInCitedDocuments(structure).map((article) => article.span)),
  ...afterVerbatimLeads(paragraphs, source, leads),
];

export const isReproduced = (span: Span, reproduced: readonly Span[]): boolean =>
  reproduced.some((outer) => outer.start <= span.start && span.end <= outer.end);
