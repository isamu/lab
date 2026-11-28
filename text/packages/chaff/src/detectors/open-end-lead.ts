import type { BulletList, LexiconEntry, Sentence, Span } from "../plugin.ts";
import { entryCloses } from "./lexicon-match.ts";

// The items of a list under a sentence that forbids or permits them (次の行為をしてはならない。 1. 知的財産権等を侵害すること):
// each item names a forbidden or permitted act, and a list in it is left open on purpose, as it would be in the sentence
// itself. Pure: the sentences, the lists and the language's prohibition and permission words come in.

/** Between a lead and its list: only blank space. */
const ONLY_SPACE = /^\s*$/u;

/** The run of items, written with line marks (①, ・) rather than as a list, that the item at index starts. */
const itemRun = (sentences: readonly Sentence[], index: number): Span | undefined => {
  const first = sentences[index];
  if (first?.listItem !== true || sentences[index - 1]?.listItem === true) return undefined;
  const after = sentences.slice(index).findIndex((sentence) => sentence.listItem !== true);
  const last = sentences[after === -1 ? sentences.length - 1 : index + after - 1] ?? first;
  return { start: first.span.start, end: last.span.end };
};

/** Where each list stands: the lists, and the runs of items written with line marks. */
const listsIn = (sentences: readonly Sentence[], lists: readonly BulletList[]): Span[] => [
  ...lists.map((list) => list.span),
  ...sentences.flatMap((_sentence, index) => itemRun(sentences, index) ?? []),
];

/** The last sentence that ends before the list, when only blank space stands between them. */
const leadOf = (source: string, sentences: readonly Sentence[], list: Span): Sentence | undefined => {
  const lead = sentences.findLast((sentence) => sentence.span.end <= list.start);
  return lead !== undefined && ONLY_SPACE.test(source.slice(lead.span.end, list.start)) ? lead : undefined;
};

/** The sentences, by index, in a list led by a sentence ending in a prohibition or a permission (…してはならない。). */
export const itemsOpenOnPurpose = (
  source: string,
  sentences: readonly Sentence[],
  lists: readonly BulletList[],
  onPurpose: readonly LexiconEntry[],
): ReadonlySet<number> => {
  const led = listsIn(sentences, lists).filter((list) => {
    const lead = leadOf(source, sentences, list);
    return lead !== undefined && onPurpose.some((entry) => entryCloses(lead, entry));
  });
  return new Set(
    sentences.flatMap((sentence, index) => (led.some((list) => list.start <= sentence.span.start && sentence.span.start < list.end) ? [index] : [])),
  );
};
