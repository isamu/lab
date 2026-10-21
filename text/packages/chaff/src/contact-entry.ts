import type { Span } from "./plugin.ts";

/**
 * 区切りが二つある電話番号（03-1234-5678、０５７０ - ０６４ - ５５６）。前後に英数字や / が接していれば型番や URL の一部
 * （AB123-45-6789）。短い番号（＃8891）は課題の番号（#1234）と見分けられないので数えない。
 */
const PHONE_NUMBER =
  /(?<![0-9０-９A-Za-zＡ-Ｚａ-ｚ/#＃-])[0-9０-９]{2,5}[ 　]*[-－‐−][ 　]*[0-9０-９]{2,4}[ 　]*[-－‐−][ 　]*[0-9０-９]{3,4}(?![0-9０-９A-Za-zＡ-Ｚａ-ｚ])/u;
const SENTENCE_END = /[。．！？!?]/u;

/**
 * 電話番号を持ち、文の終わりの印の無い一文（こころの健康相談統一ダイヤル ０５７０ - ０６４ - ５５６）は、窓口の名前と番号の札。
 * 名前は窓口の付けた書き方で、文書の書き方ではない。札なら文の頭から番号の終わりまで（番号の後ろの「問合せ時間 9時～17時」は
 * 書き手の言葉）、そうでなければ空。位置は text の先頭を 0 とする。
 */
export const contactEntrySpans = (text: string): Span[] => {
  const number = PHONE_NUMBER.exec(text);
  return number === null || SENTENCE_END.test(text) ? [] : [{ start: 0, end: number.index + number[0].length }];
};
