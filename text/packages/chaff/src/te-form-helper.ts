import type { Token } from "./plugin.ts";
import { isHelperByTeFormOnly, teFormVerbOf, type InContext } from "./word-use.ts";

// orthographic-variant: a kanji verb after a て-form is the helper (書いて見る) or the next act (並んで見た), and the form alone
// cannot tell. These decide which, from the document's own spellings.

/** Where a word stands after a て-form. */
export type TeForm = {
  /** A full verb read as a helper only for the て-form before it, whose verb takes no object (並んで見た). */
  readonly teFormOnly?: boolean;
  /** The verb whose て-form stands before it (まとめる in まとめてみる). */
  readonly teVerb?: string;
};

type KeyedTeWord = TeForm & { readonly key: string; readonly spelling: string };

const OBJECT_PARTICLE = "を";

/** The て-form verb takes an object (芽を残して置く): the verb after it has none of its own, and is the helper. */
const teVerbHasObject = (word: InContext, tokens: readonly Token[], at: number): boolean => {
  const teVerbAt = word.previous?.pos === "SCONJ" ? at - 2 : at - 1;
  const particle = tokens[teVerbAt - 1];
  return particle?.pos === "ADP" && particle.surface === OBJECT_PARTICLE;
};

export const teFormOf = (word: InContext, tokens: readonly Token[], at: number): TeForm => {
  const teVerb = teFormVerbOf(word);
  const doubtful = isHelperByTeFormOnly(word) && !teVerbHasObject(word, tokens, at);
  return { ...(doubtful ? { teFormOnly: true } : {}), ...(teVerb === undefined ? {} : { teVerb }) };
};

const BOUND_USE = "|bound|";
const FREE_USE = "|free|";

/**
 * A verb after a て-form that may be the helper or the next act (並んで見た) is read as the full verb where the document writes
 * the full verb that way and its sure helpers (投資してみる) the other way: the writer keeps the helper in kana on purpose. It stays
 * a helper where the same verb takes the sure helper elsewhere (まとめてみました beside まとめて見ました).
 */
export const withTeFormFullVerbs = <Word extends KeyedTeWord>(words: readonly Word[]): Word[] => {
  const sureOf = (key: string): Word[] => words.filter((word) => word.key === key && word.teFormOnly !== true);
  const freeSpellingsOf = (key: string): Set<string> => new Set(words.filter((word) => word.key === key).map((word) => word.spelling));
  return words.map((word) => {
    if (word.teFormOnly !== true || !word.key.includes(BOUND_USE)) return word;
    const freeKey = word.key.replace(BOUND_USE, FREE_USE);
    const sure = sureOf(word.key);
    const sureSpellings = new Set(sure.map((helper) => helper.spelling));
    const helpsSameVerb = sure.some((helper) => helper.teVerb !== undefined && helper.teVerb === word.teVerb);
    const isFullVerbSpelling = freeSpellingsOf(freeKey).has(word.spelling) && sure.length > 0 && !sureSpellings.has(word.spelling) && !helpsSameVerb;
    return isFullVerbSpelling ? { ...word, key: freeKey } : word;
  });
};
