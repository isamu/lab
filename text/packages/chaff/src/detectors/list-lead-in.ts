import type { BulletList, Sentence, Span } from "../plugin.ts";
import { endsWithColon } from "./lead-in.ts";

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
const sentenceRightBefore = (sentences: readonly Sentence[], list: BulletList, source: string): Sentence | undefined => {
  const before = sentences[countEndingBy(sentences, list.span.start) - 1];
  return before !== undefined && ONLY_BLANKS.test(source.slice(before.span.end, list.span.start)) ? before : undefined;
};

const insideAny = (spans: readonly Span[], offset: number): boolean => spans.some((span) => span.start <= offset && offset < span.end);

/** A label's words, without its colon and bold marks (**参考:** → 参考). */
const EMPHASIS = new Set(["*", "_"]);
const LABEL_END = /[\s*_:：]/u;

const labelWords = (text: string): string => {
  const chars = Array.from(text.trim());
  const start = chars.findIndex((char) => !EMPHASIS.has(char));
  const end = chars.findLastIndex((char) => !LABEL_END.test(char));
  return start === -1 || end < start ? "" : chars.slice(start, end + 1).join("");
};

/** A noun with no kana inflection (参考, 注意点): a name, not a sentence (以下の通りです) and not a lone symbol (⚠️). */
const NOUN_LABEL = /^(?=.*\p{L})[^\p{Script=Hiragana}]+$/u;

/** An English label is a name of a word or three (See also, Pros); past that it is a sentence (Here's what you need). */
const MAX_LABEL_WORDS = 3;

const isNounLabel = (words: string): boolean => NOUN_LABEL.test(words) && words.split(/\s+/u).length <= MAX_LABEL_WORDS;

/**
 * A field of an entry's template: the same noun label before the list of each entry (**参考:** before each entry's link).
 * It names the field the way a table's column does; it does not lead into anything.
 */
const fieldLabels = (leadIns: readonly Sentence[]): ReadonlySet<string> => {
  const counts = leadIns
    .map((sentence) => labelWords(sentence.text))
    .reduce((tally, words) => tally.set(words, (tally.get(words) ?? 0) + 1), new Map<string, number>());
  return new Set([...counts].filter(([words, count]) => count > 1 && isNounLabel(words)).map(([words]) => words));
};

/**
 * Prose sentences ending in a colon that hand the reader straight to a list (「以下の通りです：」, "Here's what you need:").
 * An item of a list is not prose: 「例: `code`」 ends in a colon once its code is masked, and it leads nowhere.
 */
export const colonLeadIns = (sentences: readonly Sentence[], lists: readonly BulletList[], listSpans: readonly Span[], source: string): Sentence[] => {
  const leadIns = lists.flatMap((list) => {
    const before = sentenceRightBefore(sentences, list, source);
    return before !== undefined && endsWithColon(before.text) && !insideAny(listSpans, before.span.start) ? [before] : [];
  });
  const fields = fieldLabels(leadIns);
  return leadIns.filter((sentence) => !fields.has(labelWords(sentence.text)));
};
