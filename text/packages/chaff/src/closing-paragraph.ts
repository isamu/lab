import type { Paragraph, Section, Sentence } from "./plugin.ts";

/**
 * 結びとして読む、最後の節の終わりの段落の数。決まり文句の後ろに一言や追記が続く結び（「いかがでしたか。」→ 感想 → 「よいお年を！」）は
 * 人の書いた記事に多く、最後の段落だけでは取りこぼす。
 */
const CLOSING_PARAGRAPHS = 4;

/** 文書の最初の段落は書き出しで、結びではない（冒頭の「簡単にまとめると、」）。段落が一つだけなら、それが結びでもある。 */
const isOpening = (paragraphs: readonly Paragraph[], paragraph: Paragraph): boolean => paragraphs.length > 1 && paragraphs[0] === paragraph;

/**
 * 結びの文。最後の節の終わりの段落で、書き出しの段落でないもの。見出しの無い文書は本文全体が一つの節なので、節だけで切ると冒頭の
 * 「まとめると」や、長い書き起こしの途中の問いかけまで結びになる。箇条書きは段落に数えない。
 */
export const closingSentences = (sections: readonly Pick<Section, "span">[], paragraphs: readonly Paragraph[]): readonly Sentence[] => {
  const last = sections.at(-1);
  if (last === undefined) return [];
  return paragraphs
    .filter((paragraph) => paragraph.span.start >= last.span.start && paragraph.span.start < last.span.end)
    .slice(-CLOSING_PARAGRAPHS)
    .filter((paragraph) => !isOpening(paragraphs, paragraph))
    .flatMap((paragraph) => paragraph.sentences);
};
