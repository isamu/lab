// empty-intensifier: phrase-match over the language's word list, except a statement of necessity (「不可欠です」) that
// names what it is necessary for in the same sentence (「〜のためには、Ｘが不可欠です」). That states a condition; it does
// not lean on the word for weight. The entries of group necessity and the purpose words come from the word lists. Pure.
import type { Detector, LexiconEntry, Sentence, Token } from "../plugin.ts";
import { entryRanges } from "./lexicon-match.ts";
import { phraseMatchWhere } from "./phrase-match.ts";

const NECESSITY = "necessity";
const PARTICLE = "ADP";

/**
 * Whether the words before one use of the phrase (starting at token `start`) name a purpose: a purpose word anywhere
 * before it (ために, 上で), or, for a word with position before, the particle right before it (「配送に欠かせません」の「に」,
 * not the に of 本当に).
 */
export const namesPurposeAt = (sentence: Sentence, tokens: readonly Token[], start: number, purposes: readonly LexiconEntry[]): boolean => {
  const first = tokens[start];
  if (first === undefined) return false;
  const before = sentence.text.slice(0, first.span.start - sentence.span.start);
  const previous = tokens[start - 1];
  return purposes.some((purpose) =>
    purpose.position === "before" ? previous?.pos === PARTICLE && previous.surface === purpose.pattern : before.includes(purpose.pattern),
  );
};

/** Every use of the phrase in the sentence names its purpose. Without tokens, nothing is read as named. */
export const everyUseNamesPurpose = (sentence: Sentence, entry: LexiconEntry, purposes: readonly LexiconEntry[]): boolean => {
  const tokens = sentence.tokens ?? [];
  const ranges = entryRanges(sentence, entry);
  return ranges.length > 0 && ranges.every((range) => namesPurposeAt(sentence, tokens, range.start, purposes));
};

export const emptyIntensifier: Detector = (doc, options) => {
  const purposes = doc.lexicons["necessity-purpose"] ?? [];
  return phraseMatchWhere(doc, options, (sentence, entry) => entry.group !== NECESSITY || !everyUseNamesPurpose(sentence, entry, purposes));
};
