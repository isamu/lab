import { documentLineParagraphs } from "./line-paragraphs.ts";
import { listItemParagraphs } from "./list-item-paragraphs.ts";
import type { Paragraph, Sentence, Span } from "./plugin.ts";

/** sentences（並び順）の中で、start が offset 以上の最初の添字。1 行 1 段落の何万行でも、段落ごとに全部をなめない。 */
const firstStartingAt = (sentences: readonly Sentence[], offset: number): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return low;
    const middle = (low + high) >> 1;
    return (sentences[middle]?.span.start ?? Number.POSITIVE_INFINITY) >= offset ? search(low, middle) : search(middle + 1, high);
  };
  return search(0, sentences.length);
};

const sentencesWithin = (sentences: readonly Sentence[], span: Span): Sentence[] =>
  sentences.slice(firstStartingAt(sentences, span.start), firstStartingAt(sentences, span.end));

/** 文書の段落と、その中の文。spans は Markdown の段落、listSpans は箇条書きの項目と同じに読む範囲。 */
export const paragraphsOf = (prose: string, spans: readonly Span[], sentences: readonly Sentence[], listSpans: readonly Span[]): Paragraph[] => {
  // 箇条書きの中の段落は「段落」として数えない。項目 1 つを 1 段落と読むと、
  // 段落あたりの文数も長さのばらつきも、箇条書きの多い文書で壊れる。
  const outsideLists = spans.filter((span) => !listSpans.some((list) => span.start >= list.start && span.start < list.end));
  const withSentences = outsideLists.map((span) => ({ span, sentences: sentencesWithin(sentences, span).map((sentence) => sentence.span) }));
  // 1 行 1 段落の書き方かは、行頭の印の項目で割る前の段落で決める。割った後の段落は、その手がかりにならない。
  const items = documentLineParagraphs(prose, withSentences).flatMap((span) => listItemParagraphs(span, sentencesWithin(sentences, span)));
  return items.map((span) => ({ span, sentences: sentencesWithin(sentences, span) }));
};
