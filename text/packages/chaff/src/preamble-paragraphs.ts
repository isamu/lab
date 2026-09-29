import type { Paragraph } from "./plugin.ts";
import { isClosed } from "./sentence-shape.ts";

/**
 * 本題の前にあって、読み手が読み通す段落。文が一つも終止符で閉じない段落は数えない。
 * 分類の札（「エネルギー・環境」）、著者と所属の行、「印刷」、テンプレートの指示は文ではなく、読ませる前置きではない。
 */
export const preambleParagraphs = (paragraphs: readonly Paragraph[], bodyStart: number): Paragraph[] =>
  paragraphs.filter((paragraph) => paragraph.span.start < bodyStart && paragraph.sentences.some(isClosed));
