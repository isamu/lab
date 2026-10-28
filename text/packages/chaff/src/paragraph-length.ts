/**
 * 段落が長すぎるか。文の数が上限を超え、しかも長さが「上限の数だけ普通の長さの文を並べた長さ」を超えるときだけ。
 * 短い文をいくつ並べても、読み手が息をつけない壁にはならない。長さは adapter の単位（日本語は文字、英語は語）。
 * fullSentence が無ければ、文の数だけで決める。
 */
export const isTooLongParagraph = (sentenceSizes: readonly number[], limit: number, fullSentence: number | undefined): boolean => {
  const size = sentenceSizes.reduce((sum, sentence) => sum + sentence, 0);
  return sentenceSizes.length > limit && (fullSentence === undefined || size > limit * fullSentence);
};

type Spanned = { readonly span: { readonly start: number; readonly end: number } };

/** 【】の見出しや段落番号だけの行（【０００１】、【従来の技術】）。特許の明細書や公文書を写すと改行一つでつながり、Markdown では一つの段落になる。 */
const LABEL_LINE = /^[ \t\u3000]*【[^】\n]+】[ \t\u3000]*$/gmu;

/** 段落の頭の、番号付きの【】の見出しに、改行なしで本文が続く（２【沿革】1893年…）。写すときに改行が落ち、どこが段落の切れ目か分からない。 */
const FUSED_HEADING = /^[ \t\u3000]*[0-9０-９①-⑳]{1,3}【[^】\n]+】[ \t\u3000]*[^\s]/u;

/** 段落の本文が、番号付きの見出しから改行なしで始まる。段落の切れ目が失われた文書で、長さを測っても書き手の段落ではない。 */
export const opensWithFusedHeading = (text: string): boolean => FUSED_HEADING.test(text);

/** 【】のラベルだけの文（【０００１】【技術分野】）。見出しで、文に数えない。 */
const LABELS_ONLY = /^\s*(?:【[^】\n]+】\s*)+$/u;

/**
 * 段落の文を、【】の見出しや段落番号だけの行で割った組。読み手にとってはその行が段落の切れ目で、ラベルだけの文は数えない。
 * text は段落の文字列で、start はその文書の中の位置（文の span と同じ座標）。割る行が無ければ段落の文がそのまま一つの組。
 */
export const labelledBlocks = <T extends Spanned>(text: string, start: number, sentences: readonly T[]): T[][] => {
  const cuts = [...text.matchAll(LABEL_LINE)].map((match) => start + match.index);
  if (cuts.length === 0) return sentences.length === 0 ? [] : [[...sentences]];
  const blocks = new Map<number, T[]>();
  sentences
    .filter((sentence) => !LABELS_ONLY.test(text.slice(sentence.span.start - start, sentence.span.end - start)))
    .forEach((sentence) => {
      const block = cuts.filter((cut) => cut < sentence.span.end).length;
      blocks.set(block, [...(blocks.get(block) ?? []), sentence]);
    });
  return [...blocks.values()];
};
