import { charLength, proseText } from "../measure.ts";
import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";

/** 文が少ないと変動係数は当てにならない。ここを下回る文書は見ない。 */
const MIN_SENTENCES = 8;

const coefficientOfVariation = (sizes: readonly number[]): number => {
  const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  if (mean === 0) return 0;
  const variance = sizes.reduce((sum, size) => sum + (size - mean) ** 2, 0) / sizes.length;
  return Math.sqrt(variance) / mean;
};

/** n 文の変動係数の標準誤差はおよそ cv/√(2n)。下限との差がその内なら、文の少なさによる揺れと区別できないので指摘しない。 */
export const clearlyBelow = (spread: number, sentences: number, limit: number): boolean => Math.round(spread + spread / Math.sqrt(2 * sentences)) < limit;

/** 箇条書きの項目は揃えて書くのが正しい形なので、地の文の文だけを測る。 */
const proseSentences = (doc: ProseDocument): readonly Sentence[] => doc.paragraphs.flatMap((paragraph) => paragraph.sentences);

export const sentenceRhythm: Detector = (doc, options): Finding[] => {
  const sentences = proseSentences(doc);
  const sizes = sentences.map((sentence) => charLength(sentence));
  if (sizes.length < MIN_SENTENCES) return [];
  const spread = coefficientOfVariation(sizes) * 100;
  if (!clearlyBelow(spread, sizes.length, options.limit)) return [];
  return [
    {
      rule: "sentence-rhythm",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentences[0] === undefined ? "" : proseText(sentences[0]),
      values: { count: Math.round(spread), limit: options.limit, offset: sentences[0]?.span.start ?? 0 },
    },
  ];
};
