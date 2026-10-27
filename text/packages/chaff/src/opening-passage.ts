import { proseText } from "./measure.ts";
import type { ProseDocument, Sentence } from "./plugin.ts";

/** 書き出しとして読む文の数。最初の文だけでは、一般論のあとに具体が続くのか分からない。 */
export const OPENING_PROSE_SENTENCES = 3;

/** 文として閉じているか。日付・署名・「6 min read」のような冒頭の飾りの行は句点で終わらない。 */
const TERMINATED = /[。．.!?！？…‥][」』】”"')）]*$/u;

const DIGIT = /[0-9０-９]/u;

const isProse = (sentence: Sentence): boolean => sentence.listItem !== true && sentence.embeddedLanguage === undefined;

/** 文を含む節の終わり。次の節の文は書き出しではない。 */
const sectionEnd = (doc: ProseDocument, sentence: Sentence): number =>
  doc.sections.findLast((section) => section.span.start <= sentence.span.start)?.span.end ?? doc.source.length;

/** 書き出しの文。句点で閉じた最初の本文の文から、同じ節の、箇条書きでない文を数える。無ければ空。 */
export const openingProse = (doc: ProseDocument): readonly Sentence[] => {
  const start = doc.sentences.findIndex((sentence) => isProse(sentence) && TERMINATED.test(proseText(sentence)));
  const first = doc.sentences[start];
  if (first === undefined) return [];
  const end = sectionEnd(doc, first);
  return doc.sentences
    .slice(start)
    .filter((sentence) => isProse(sentence) && sentence.span.end <= end)
    .slice(0, OPENING_PROSE_SENTENCES);
};

/** 最初の文が数（日付・件数・金額）を言うなら、書き出しはもう具体から始まっている。 */
export const opensWithNumber = (opening: readonly Sentence[]): boolean => opening[0] !== undefined && DIGIT.test(proseText(opening[0]));
