// A worn phrase whose words also have a plain sense ("Empty the tray at the end of the day", "Every version is on the
// same page") counts only where its sentence reads it as the figure. The language's word list gives, for each such
// phrase (group), regular expressions of the figurative use; a phrase without any counts everywhere. Pure.
import type { LexiconEntry, Sentence } from "../plugin.ts";

export type PhraseContexts = ReadonlyMap<string, readonly RegExp[]>;

export const phraseContextsOf = (entries: readonly LexiconEntry[]): PhraseContexts =>
  entries.reduce((contexts, entry) => {
    const phrase = entry.group?.toLowerCase();
    if (phrase === undefined) return contexts;
    return new Map([...contexts, [phrase, [...(contexts.get(phrase) ?? []), new RegExp(entry.pattern, "iu")]]]);
  }, new Map<string, readonly RegExp[]>());

/** Whether the sentence uses the entry as the figure: no context listed for it, or one of its contexts matches. */
export const inFigurativeContext = (sentence: Sentence, entry: LexiconEntry, contexts: PhraseContexts): boolean => {
  const patterns = contexts.get(entry.pattern.toLowerCase());
  return patterns === undefined || patterns.some((pattern) => pattern.test(sentence.text));
};
