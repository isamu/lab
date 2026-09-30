/**
 * 和文の中の英文（英語の要旨、英語の文献）。仮名を含まず、字の半分以上が英字。
 * 漢字だけなら含んでよい（英文の中の「東京」）。仮名があれば和文の一部と読む。
 */
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const LATIN = /\p{Script=Latin}/gu;
const COUNTABLE = /\S/gu;
// 英文の文末。閉じ括弧・引用符が続いてよい。断片の末尾だけを見る。
const ENGLISH_STOP_AT_END = /[.?!][)\]"'”’]{0,3}$/u;
const TAIL_LENGTH = 4;

export const isEnglishRun = (text: string): boolean => {
  if (KANA.test(text)) return false;
  const latin = [...text.matchAll(LATIN)].length;
  return latin > 0 && latin * 2 >= [...text.matchAll(COUNTABLE)].length;
};

/**
 * 分割器が切った二つの断片の間が、英文と英文の切れ目か。
 * 後ろが和文なら切れ目と読まない。「Version 2.0. を使う」「See Fig. 1. これは図」の英字の後のピリオドと見分けられないため。
 * before は前の断片をつないだもので長くなりうるので、短い after を先に見る。
 */
export const isEnglishBoundary = (before: string, after: string): boolean =>
  ENGLISH_STOP_AT_END.test(before.trimEnd().slice(-TAIL_LENGTH)) && isEnglishRun(after) && isEnglishRun(before);
