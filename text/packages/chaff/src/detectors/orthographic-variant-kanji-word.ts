import { dropsOkurigana, kanjiSkeleton } from "../kana-spelling.ts";

type KanjiWord = { readonly spelling: string; readonly compoundHead?: boolean; readonly kanaStem?: boolean; readonly compoundTail?: string };

const ONE_KANJI = /^\p{Script=Han}$/u;

export const isOneKanjiElement = (word: KanjiWord, spellings: readonly string[]): boolean =>
  word.compoundHead === true && ONE_KANJI.test(word.spelling) && dropsOkurigana(word.spelling, spellings);

/**
 * A verb's stem in kana read as its noun (つき of つきたて) meets only a kanji spelling that ends in the same kana, as the
 * verb's noun does (付き): a kanji noun of the same sound that ends in its kanji (月) is another word.
 */
export const isStemWithoutItsKanji = (word: KanjiWord, spellings: readonly string[], skeletonOf: (spelling: string) => string): boolean =>
  word.kanaStem === true && !spellings.some((spelling) => skeletonOf(spelling) !== "" && spelling.endsWith(word.spelling.slice(-1)));

/** Okurigana between two kanji (the し of 申し込み), which the general rules keep and official Japanese drops (申込み). */
const KANA_BETWEEN_KANJI = /\p{Script=Han}[ぁ-ゖ]+\p{Script=Han}/u;

/**
 * A compound head in kanji alone (申込 of 申込締切, 申込書) beside spellings that keep okurigana between its kanji
 * (申し込み画面): the general rules write the word that way and a set compound in kanji alone, so the two are one
 * convention. It is still compared where the document writes the word in kanji alone outside a compound (休業の申出 beside
 * 申し出期限), writes it the official way with okurigana only at the end (取扱い方法 beside 事務取扱担当者), or writes the
 * same compound both ways (申込方法 and 申し込み方法).
 */
export const isSetCompoundBesideGeneralRules = (word: KanjiWord, group: readonly KanjiWord[]): boolean => {
  if (word.compoundTail === undefined) return false;
  const others = group.filter((other) => other.spelling !== word.spelling && kanjiSkeleton(other.spelling) === word.spelling);
  if (others.length === 0 || !others.every((other) => KANA_BETWEEN_KANJI.test(other.spelling))) return false;
  const alone = group.some((other) => other.spelling === word.spelling && other.compoundTail === undefined);
  return !alone && !others.some((other) => other.compoundTail === word.compoundTail);
};
