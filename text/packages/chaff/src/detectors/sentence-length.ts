import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";

/** 日本語は文字、英語は語。単位は adapter が宣言する。spec §7。 */
const measure = (doc: ProseDocument, sentence: Sentence): number => {
  const text = sentence.text.trim();
  if (doc.lengthUnit === "char") return text.length;
  return text.split(/\s+/u).filter((word) => word.length > 0).length;
};

export const sentenceLength: Detector = (doc, options): Finding[] =>
  doc.sentences
    .map((sentence) => ({ sentence, size: measure(doc, sentence) }))
    .filter(({ size }) => size > options.limit)
    .map(({ sentence, size }) => ({
      rule: "max-sentence-length",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { count: size, limit: options.limit, offset: sentence.span.start },
    }));
