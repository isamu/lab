// An item's own words: the sentences in its span, less a list nested in it or a note line under it. Pure.

import type { ProseDocument, Sentence, Span } from "../plugin.ts";

const within = (inner: Span, outer: Span): boolean => inner.start >= outer.start && inner.end <= outer.end;

/** The item's own sentences: those in its span, less those of a list nested inside it. */
export const itemSentences = (doc: ProseDocument, item: Span): Sentence[] => {
  const nested = doc.lists.map((list) => list.span).filter((span) => span.start > item.start && within(span, item));
  return doc.sentences.filter((sentence) => within(sentence.span, item) && !nested.some((span) => within(sentence.span, span)));
};

/**
 * Where an item's own words end: before a line in it that opens, unindented, with a note lead (※応募書類は返却できません。,
 * "Note: …"). Markdown reads such a line as the last item's, but the note is about the whole list.
 */
export const itemOwnEnd = (source: string, item: Span, noteLeads: readonly string[]): number => {
  const lineStarts = [...source.slice(item.start, item.end).matchAll(/\n/gu)].map((match) => item.start + match.index + 1);
  const noteLine = lineStarts.find((start) => noteLeads.some((lead) => lead !== "" && source.startsWith(lead, start)));
  return noteLine === undefined ? item.end : noteLine - 1;
};

/** The sentence up to `end`: a note line under the item is not part of the item's last sentence. */
const cutAt = (sentence: Sentence, end: number, source: string): Sentence =>
  sentence.span.end <= end
    ? sentence
    : {
        ...sentence,
        span: { start: sentence.span.start, end },
        text: source.slice(sentence.span.start, end),
        ...(sentence.tokens === undefined ? {} : { tokens: sentence.tokens.filter((token) => token.span.end <= end) }),
      };

/** The item's own sentences, up to a note line under it. */
export const ownSentences = (doc: ProseDocument, item: Span, noteLeads: readonly string[]): Sentence[] => {
  const end = itemOwnEnd(doc.source, item, noteLeads);
  return itemSentences(doc, item).flatMap((sentence) => (sentence.span.start < end ? [cutAt(sentence, end, doc.source)] : []));
};
