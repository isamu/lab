// Reading masked source into prose and prose into sentences, paragraph by paragraph. Shared by the document model and
// its scoped reading (headings and quotations). Pure.
import { maskSpans } from "./mask.ts";
import { spansWithin } from "./soft-break.ts";
import { segmentJoined } from "./joined-view.ts";
import { speakerLabels } from "./speaker-labels.ts";
import type { LanguageAdapter, Sentence, Span } from "./plugin.ts";

export const startsInside = (span: Span, regions: readonly Span[]): boolean => regions.some((region) => span.start >= region.start && span.start < region.end);

/**
 * 文の分割は**段落ごと**に行う。
 *
 * 文書全体を一度に渡すと、句点で終わらない行（「条件:」のような見出し的な行）が、
 * 覆った表やコードブロックを越えて次の句点まで飲み込む。段落は文が跨がない境界なので、
 * ここで切れば構造的に起きない。
 */
export const shift = (span: Span, by: number): Span => ({ start: by + span.start, end: by + span.end });

const breaksWithin = (breaks: readonly Span[], paragraph: Span): Span[] => spansWithin(breaks, paragraph).map((span) => shift(span, -paragraph.start));

export const sentencesOf = (prose: string, paragraphs: readonly Span[], adapter: LanguageAdapter, softBreaks: readonly Span[]): Sentence[] =>
  paragraphs.flatMap((paragraph) =>
    segmentJoined(prose.slice(paragraph.start, paragraph.end), breaksWithin(softBreaks, paragraph), (text) => adapter.segment(text))
      .filter((sentence) => sentence.text.trim().length > 0)
      .map((sentence) => ({
        span: shift(sentence.span, paragraph.start),
        text: sentence.text,
        ...(sentence.tokens === undefined ? {} : { tokens: sentence.tokens.map((token) => ({ ...token, span: shift(token.span, paragraph.start) })) }),
        ...(sentence.wrapBreaks === undefined ? {} : { wrapBreaks: sentence.wrapBreaks.map((span) => shift(span, paragraph.start)) }),
        ...(sentence.embeddedLanguage === undefined ? {} : { embeddedLanguage: sentence.embeddedLanguage }),
        ...(sentence.listItem === undefined ? {} : { listItem: sentence.listItem }),
      })),
  );

/**
 * masked を覆った本文から、話し手の名前（戯曲・議事録）も覆う。名前は誰が話すかの印で、文でも本文でもない。
 * 名前は覆った後の本文で探す。コードや表の中の行頭を話し手と数えない。
 */
export const proseOf = (source: string, masked: readonly Span[]): string => {
  const unlabelled = maskSpans(source, masked);
  return maskSpans(unlabelled, speakerLabels(unlabelled));
};
