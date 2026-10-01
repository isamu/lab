import type { Paragraph, Section, Sentence } from "./plugin.ts";

/**
 * 結びの文。最後の節の、さらに最後の段落だけ。見出しの無い文書は本文全体が一つの節なので、節だけで切ると冒頭の「まとめると」まで結びになる。
 * 最後の節が箇条書きだけなら、結びの段落は無い。
 */
export const closingSentences = (sections: readonly Pick<Section, "span">[], paragraphs: readonly Paragraph[]): readonly Sentence[] => {
  const last = sections.at(-1);
  if (last === undefined) return [];
  const closing = paragraphs.findLast((paragraph) => paragraph.span.start >= last.span.start && paragraph.span.start < last.span.end);
  return closing?.sentences ?? [];
};
