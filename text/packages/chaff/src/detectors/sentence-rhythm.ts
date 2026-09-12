import { charLength, proseText } from "../measure.ts";
import type { Detector, Finding } from "../plugin.ts";

/** 文が少ないと変動係数は当てにならない。ここを下回る文書は見ない。 */
const MIN_SENTENCES = 8;

const coefficientOfVariation = (sizes: readonly number[]): number => {
  const mean = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
  if (mean === 0) return 0;
  const variance = sizes.reduce((sum, size) => sum + (size - mean) ** 2, 0) / sizes.length;
  return Math.sqrt(variance) / mean;
};

export const sentenceRhythm: Detector = (doc, options): Finding[] => {
  const sizes = doc.sentences.map((sentence) => charLength(sentence));
  if (sizes.length < MIN_SENTENCES) return [];
  const spread = Math.round(coefficientOfVariation(sizes) * 100);
  if (spread >= options.limit) return [];
  return [
    {
      rule: "sentence-rhythm",
      severity: "warning",
      line: 0,
      column: 0,
      quote: doc.sentences[0] === undefined ? "" : proseText(doc.sentences[0]),
      values: { count: spread, limit: options.limit, offset: doc.sentences[0]?.span.start ?? 0 },
    },
  ];
};
