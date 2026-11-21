import type { Sentence } from "../plugin.ts";

/** 見せる前後の字数。記号 1 つの指摘は、周りの言葉が無いとどこか分からない。 */
const QUOTE_REACH = 20;

/** text の start から end の前後を、空白をならして引く。 */
export const quoteAround = (text: string, start: number, end: number = start + 1): string =>
  text
    .slice(Math.max(0, start - QUOTE_REACH), end + QUOTE_REACH)
    .replace(/\s+/gu, " ")
    .trim();

/** The sentence holding offset, trimmed: a reader sees whole words, as for the rules that quote their sentence. undefined outside every sentence. */
export const sentenceQuoteAt = (sentences: readonly Sentence[], offset: number): string | undefined =>
  sentences.find((sentence) => sentence.span.start <= offset && offset < sentence.span.end)?.text.trim();
