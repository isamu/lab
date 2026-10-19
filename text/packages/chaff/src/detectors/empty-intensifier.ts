// empty-intensifier: phrase-match over the language's word list, except a statement of necessity (「不可欠です」) that
// names what it is necessary for in the same sentence (「〜のためには、Ｘが不可欠です」). That states a condition; it does
// not lean on the word for weight. The entries of group necessity and the purpose words come from the word lists. Pure.
import { proseText } from "../measure.ts";
import type { Detector, LexiconEntry } from "../plugin.ts";
import { phraseMatchWhere } from "./phrase-match.ts";

const NECESSITY = "necessity";

/**
 * Whether the words before the phrase name a purpose: a purpose word anywhere before it (ためには, 上で), or, for a word
 * with position before, right before it (「業務に欠かせません」の「に」).
 */
export const namesPurpose = (text: string, phrase: string, purposes: readonly LexiconEntry[]): boolean => {
  const at = text.indexOf(phrase);
  if (at <= 0) return false;
  const before = text.slice(0, at).trimEnd();
  return purposes.some((purpose) => (purpose.position === "before" ? before.endsWith(purpose.pattern) : before.includes(purpose.pattern)));
};

export const emptyIntensifier: Detector = (doc, options) => {
  const purposes = doc.lexicons["necessity-purpose"] ?? [];
  return phraseMatchWhere(doc, options, (sentence, entry) => entry.group !== NECESSITY || !namesPurpose(proseText(sentence), entry.pattern, purposes));
};
