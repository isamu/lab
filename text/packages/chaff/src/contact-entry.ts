import type { Span } from "./plugin.ts";

/** 区切りのある電話番号（03-1234-5678、０５７０ - ０６４ - ５５６）と、短い番号（＃8891）。 */
const PHONE_NUMBER = /[0-9０-９]{2,5}[ 　]*[-－‐−][ 　]*[0-9０-９]{2,4}[ 　]*[-－‐−][ 　]*[0-9０-９]{3,4}|[#＃][0-9０-９]{3,5}/u;
const SENTENCE_END = /[。．！？!?]/u;

/**
 * 電話番号を持ち、文の終わりの印の無い一文（こころの健康相談統一ダイヤル ０５７０ - ０６４ - ５５６）は、窓口の名前と番号の札。
 * 名前は窓口の付けた書き方で、文書の書き方ではない。札ならその文全体の範囲、そうでなければ空。位置は text の先頭を 0 とする。
 */
export const contactEntrySpans = (text: string): Span[] => (PHONE_NUMBER.test(text) && !SENTENCE_END.test(text) ? [{ start: 0, end: text.length }] : []);
