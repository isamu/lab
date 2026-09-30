import type { Token } from "chaffjs/plugin";

const KATAKANA_WORD = /^[ァ-ヺー]+$/u;
const LONG_VOWEL = "ー";

/** A katakana noun written without a final ー, which could be a loanword whose final long vowel was dropped (コンピュータ). */
const mayHaveDropped = (token: Token): boolean =>
  token.pos === "NOUN" && KATAKANA_WORD.test(token.surface) && !token.surface.endsWith(LONG_VOWEL) && Array.from(token.surface).length > 1;

/**
 * Marks a katakana noun whose form with a final ー is a word the dictionary knows (コンピュータ → コンピューター): LongVowelEnding=Dropped.
 * Only the dictionary can tell a dropped long vowel (メモリ) from a word that never had one (データ, ハードウェア).
 * knowsWithLongVowel is given by index.ts, which holds the analyser; each surface is asked once.
 */
export const markDroppedLongVowels = (tokens: readonly Token[], knowsWithLongVowel: (surface: string) => boolean): Token[] =>
  tokens.map((token) =>
    mayHaveDropped(token) && knowsWithLongVowel(token.surface) ? { ...token, features: { ...token.features, LongVowelEnding: "Dropped" } } : token,
  );

/** Whether text reads as one word the dictionary knows (a lemma, not an unknown run of katakana). */
export const knownWordReading =
  (tokenize: (text: string) => readonly Token[] | undefined) =>
  (surface: string): boolean => {
    const read = tokenize(`${surface}${LONG_VOWEL}`);
    return read?.length === 1 && read[0]?.lemma !== undefined && read[0].pos === "NOUN";
  };

/** Remembers each answer: a document repeats its words, and the analyser is the cost. */
export const remembered = (ask: (surface: string) => boolean): ((surface: string) => boolean) => {
  const answers = new Map<string, boolean>();
  return (surface) => {
    const known = answers.get(surface);
    if (known !== undefined) return known;
    const answer = ask(surface);
    answers.set(surface, answer);
    return answer;
  };
};
