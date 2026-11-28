import type { BulletList, Sentence } from "./plugin.ts";

/** Between a lead-in and its list: only blank space. A thematic break (`***`) separates them; bold marks sit inside the sentence. */
const ONLY_BLANKS = /^\s*$/u;

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
export const sentenceRightBefore = (sentences: readonly Sentence[], list: BulletList, source: string): Sentence | undefined => {
  const before = sentences[countEndingBy(sentences, list.span.start) - 1];
  return before !== undefined && ONLY_BLANKS.test(source.slice(before.span.end, list.span.start)) ? before : undefined;
};

/** The sentences that hand the reader straight to a list (以下のとおり説明。 / 主な内容は以下の通り。), one per list at most. Pure. */
export const listLeadSentences = (sentences: readonly Sentence[], lists: readonly BulletList[], source: string): ReadonlySet<Sentence> =>
  new Set(lists.flatMap((list) => sentenceRightBefore(sentences, list, source) ?? []));
