import type { BulletList, Sentence, Span } from "../plugin.ts";
import { endsWithColon } from "./lead-in.ts";

/** Between a lead-in and its list: only blanks and the closing marks of bold (`**Steps**:`). */
const ONLY_BLANKS = /^[\s*_]*$/u;

/** How many sentences end at or before an offset. Sentences are in document order, so a binary search. */
const countEndingBy = (sentences: readonly Sentence[], offset: number): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return low;
    const middle = Math.floor((low + high) / 2);
    return (sentences[middle]?.span.end ?? Infinity) <= offset ? search(middle + 1, high) : search(low, middle);
  };
  return search(0, sentences.length);
};

/** The sentence that ends last before the list starts, if nothing but blanks lies between them. */
const sentenceRightBefore = (sentences: readonly Sentence[], list: BulletList, source: string): Sentence | undefined => {
  const before = sentences[countEndingBy(sentences, list.span.start) - 1];
  return before !== undefined && ONLY_BLANKS.test(source.slice(before.span.end, list.span.start)) ? before : undefined;
};

const insideAny = (spans: readonly Span[], offset: number): boolean => spans.some((span) => span.start <= offset && offset < span.end);

/**
 * Prose sentences ending in a colon that hand the reader straight to a list (「以下の通りです：」, "Here's what you need:").
 * An item of a list is not prose: 「例: `code`」 ends in a colon once its code is masked, and it leads nowhere.
 */
export const colonLeadIns = (sentences: readonly Sentence[], lists: readonly BulletList[], listSpans: readonly Span[], source: string): Sentence[] =>
  lists.flatMap((list) => {
    const before = sentenceRightBefore(sentences, list, source);
    return before !== undefined && endsWithColon(before.text) && !insideAny(listSpans, before.span.start) ? [before] : [];
  });
