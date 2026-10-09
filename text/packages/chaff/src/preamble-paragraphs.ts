import type { Paragraph } from "./plugin.ts";
import { isClosed } from "./sentence-shape.ts";

/** A header field on one line: a short label, a colon, and its value (To: …, Quote number: …). */
const FIELD_LINE = /^[^:：。.!?！？\n]{1,30}[:：][ \t]*(?<value>\S[^\n]*)$/u;

/** Small words a name keeps in lower case (Bank of Minato, Smith and Sons). */
const NAME_JOINERS = new Set(["of", "and", "&", "the", "for"]);

const isNameWord = (word: string): boolean => NAME_JOINERS.has(word) || /^[\p{Lu}\d]/u.test(word);

/**
 * A paragraph that is one header field whose value is a name, every word capitalised (To: Minato Manufacturing Inc.): a
 * letter's or an invoice's address block, closed only by the period of Inc. A value with a word in lower case
 * (Summary: Sales up 5%., Note: This guide covers the setup.) is a sentence.
 */
const isNameField = (paragraph: Paragraph, source: string): boolean => {
  const value = FIELD_LINE.exec(source.slice(paragraph.span.start, paragraph.span.end).trim())?.groups?.["value"];
  return value !== undefined && value.split(/\s+/u).every(isNameWord);
};

/**
 * 本題の前にあって、読み手が読み通す段落。文が一つも終止符で閉じない段落は数えない。
 * 分類の札（「エネルギー・環境」）、著者と所属の行、「印刷」、テンプレートの指示は文ではなく、読ませる前置きではない。
 * 宛先や差出人の欄（To: Minato Manufacturing Inc.）も、値が名前だけなら数えない。source は段落の範囲を読む文書。
 */
export const preambleParagraphs = (paragraphs: readonly Paragraph[], bodyStart: number, source = ""): Paragraph[] =>
  paragraphs.filter((paragraph) => paragraph.span.start < bodyStart && paragraph.sentences.some(isClosed) && !isNameField(paragraph, source));
