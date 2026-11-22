import { dropsOkurigana } from "../kana-spelling.ts";

type KanjiWord = { readonly spelling: string; readonly compoundHead?: boolean; readonly kanaStem?: boolean };

const ONE_KANJI = /^\p{Script=Han}$/u;

export const isOneKanjiElement = (word: KanjiWord, spellings: readonly string[]): boolean =>
  word.compoundHead === true && ONE_KANJI.test(word.spelling) && dropsOkurigana(word.spelling, spellings);

/**
 * A verb's stem in kana read as its noun (つき of つきたて) meets only a kanji spelling that ends in the same kana, as the
 * verb's noun does (付き): a kanji noun of the same sound that ends in its kanji (月) is another word.
 */
export const isStemWithoutItsKanji = (word: KanjiWord, spellings: readonly string[], skeletonOf: (spelling: string) => string): boolean =>
  word.kanaStem === true && !spellings.some((spelling) => skeletonOf(spelling) !== "" && spelling.endsWith(word.spelling.slice(-1)));
