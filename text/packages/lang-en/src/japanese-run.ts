/**
 * A Japanese sentence in an English document (a quoted notice, a bilingual title): it has kana, and kana or kanji make
 * up at least half of its letters (digits and symbols are not counted). Kanji alone do not count, as a Chinese name in English text is not Japanese.
 */
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu;
const LETTER = /\p{L}/gu;

export const isJapaneseRun = (text: string): boolean => KANA.test(text) && [...text.matchAll(JAPANESE)].length * 2 >= [...text.matchAll(LETTER)].length;
