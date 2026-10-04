import type { Detector, Finding } from "../plugin.ts";
import { quoteAround } from "./quote-around.ts";

// A single Latin letter left inside a Japanese word by the input method (おもしrおい, 対応sた): a key pressed and not converted.

/** One stray letter, and where it is in the text. */
export type StrayLetter = { readonly offset: number; readonly letter: string };

// Hiragana or kanji before (after katakana a letter is a label: サイズm, プランb), kana after.
const STRAY = /(?<=[\p{Script=Hiragana}\p{Script=Han}々])[a-z](?=[\p{Script=Hiragana}\p{Script=Katakana}ー])/gu;
/** Marks that make the run around the letter a path, an address or an assignment (/docs/あaい, a=b). */
const PATH_MARK = /[/\\=@#]/u;

const runBefore = (text: string, offset: number): string => text.slice(0, offset).split(/\s/u).at(-1) ?? "";

/**
 * One lower-case letter between Japanese: hiragana or kanji before, kana after. A letter followed by a particle names
 * something (変数xが, まずxを, をxで), so it is left alone; the particles come from the lexicon.
 */
export const strayLettersIn = (text: string, particles: readonly string[]): StrayLetter[] =>
  [...text.matchAll(STRAY)].flatMap((match) => {
    const namesSomething = particles.some((particle) => text.startsWith(particle, match.index + 1));
    return namesSomething || PATH_MARK.test(runBefore(text, match.index)) ? [] : [{ offset: match.index, letter: match[0] }];
  });

export const imeResidue: Detector = (doc): Finding[] => {
  const text = doc.prose ?? doc.source;
  const particles = (doc.lexicons["case-particle"] ?? []).map((entry) => entry.pattern);
  return strayLettersIn(text, particles).map((stray) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, stray.offset, stray.offset + 1),
    values: { letter: stray.letter, offset: stray.offset },
  }));
};
