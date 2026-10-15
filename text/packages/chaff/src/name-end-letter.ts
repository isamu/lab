// 名前の語の終わりの一字の抜けか足し（Whitmore と Whitmor、Hollybrook と Hollybrooke）。ふつうの語なら語の形の違い
// （Service と Services、America と American）なので、どちらも名前にしか使わない語に限る。

const LATIN_WORD = /^[a-z]+$/u;
const VOWEL = /[aeiouy]$/u;

/** 足すと別の語の形になる字。s は複数と所有（Rental と Rentals）。 */
const PLURAL_LETTER = "s";
/** 母音で終わる語に足すと、その土地の人や言葉の語になる字（Korea と Korean、Rica と Rican）。 */
const DEMONYM_LETTER = "n";

/** 比べる語の長さ。三字の語（Ann と Anne）は別の名前のことが多い。 */
const MIN_END_LETTER_LENGTH = 4;
/** 終わりの一字の抜けか足しを、名前の最後でない語で見る長さ（Hollybrook と Hollybrooke）。 */
const MIN_END_SLIP_ANYWHERE = 8;

const isFormLetter = (shorter: string, added: string): boolean => added === PLURAL_LETTER || (added === DEMONYM_LETTER && VOWEL.test(shorter));

/** 二つの英字の語が、終わりの一字の抜けか足しだけ違うか。足した字が語の形を作る字（s、母音の後ろの n）なら違うと見ない。 */
export const isEndLetterApart = (left: string, right: string): boolean => {
  const [shorter, longer] = left.length < right.length ? [left, right] : [right, left];
  if (!LATIN_WORD.test(shorter) || !LATIN_WORD.test(longer) || shorter.length < MIN_END_LETTER_LENGTH) return false;
  return longer.length === shorter.length + 1 && longer.startsWith(shorter) && !isFormLetter(shorter, longer.slice(shorter.length));
};

/**
 * 文書での語の使い方（小文字で）。ordinary は名前と読んだ語のうち小文字で書けばふつうの語（Rental、Green）、common は文書が
 * 小文字で書くか、品詞解析が普通名詞と読む語（hurricane、lake）。
 */
export type WordUse = { readonly ordinary: ReadonlySet<string>; readonly common: ReadonlySet<string> };

export const NO_WORD_USE: WordUse = { ordinary: new Set(), common: new Set() };

/**
 * 終わりの重なった字の一つの抜け（Licensee と License、Bennett と Bennet）で、どちらかを文書が小文字か普通名詞で書く（license）。
 * 語の終わりの抜けと同じく、語の形の違い（License と、その許諾を受ける Licensee）。
 */
export const isWordFormOf = (left: string, right: string, use: WordUse): boolean => {
  const [longer, shorter] = left.length > right.length ? [left, right] : [right, left];
  return longer.slice(0, -1) === shorter && (use.common.has(longer) || use.common.has(shorter));
};

/**
 * 名前の語（words、小文字）の at の語を usual と書いた名前があるとき、その違いを書き損じと見るか。違う語が最後の語（姓）なら、
 * 終わりの一字の抜けか足しか、四字以上の一字違い（oneLetterApart）で、前の語がどれも文書の中で普通名詞として書かない語（Rachel、Mr）
 * のとき。Hurricane Hanna と Hurricane Hannah は名前の違う二つの嵐。最後でない語なら、八字以上の終わりの一字の抜けか足しで、名前の
 * 最後の語がふつうの語（Residences、Products）のとき。人の名の終わりの一字だけ違う名前（Christian と Christiane）は別の人のことが多い。
 */
export const isEndWordSlip = (
  words: readonly string[],
  at: number,
  usual: string,
  use: WordUse,
  oneLetterApart: (left: string, right: string) => boolean,
): boolean => {
  const word = words[at] ?? "";
  const shorter = Math.min(word.length, usual.length);
  if (at < words.length - 1) return shorter >= MIN_END_SLIP_ANYWHERE && use.ordinary.has(words.at(-1) ?? "") && isEndLetterApart(word, usual);
  if (words.slice(0, at).some((before) => use.common.has(before))) return false;
  return isEndLetterApart(word, usual) || (shorter >= MIN_END_LETTER_LENGTH && oneLetterApart(word, usual));
};
