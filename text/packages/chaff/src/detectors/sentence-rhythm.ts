import { charLength, proseText } from "../measure.ts";
import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";
import { inRelease, releaseSpansOf } from "./release-notes.ts";

/** 文が少ないと変動係数は当てにならない。ここを下回る文書は見ない。 */
const MIN_SENTENCES = 8;

const coefficientOfVariation = (sizes: readonly number[]): number => {
  const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  if (mean === 0) return 0;
  const variance = sizes.reduce((sum, size) => sum + (size - mean) ** 2, 0) / sizes.length;
  return Math.sqrt(variance) / mean;
};

/** 箇条書きの項目は揃えて書くのが正しい形なので、地の文の文だけを測る。変更履歴の版ごとの記事も、揃えて書く項目と同じ。 */
const proseSentences = (doc: ProseDocument): readonly Sentence[] => {
  const releases = releaseSpansOf(doc);
  return doc.paragraphs.flatMap((paragraph) => paragraph.sentences).filter((sentence) => !inRelease(releases, sentence.span.start));
};

export const sentenceRhythm: Detector = (doc, options): Finding[] => {
  const sentences = proseSentences(doc);
  const sizes = sentences.map((sentence) => charLength(sentence));
  if (sizes.length < MIN_SENTENCES) return [];
  const spread = Math.round(coefficientOfVariation(sizes) * 100);
  if (spread >= options.limit) return [];
  return [
    {
      rule: "sentence-rhythm",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentences[0] === undefined ? "" : proseText(sentences[0]),
      values: { count: spread, limit: options.limit, offset: sentences[0]?.span.start ?? 0 },
    },
  ];
};
