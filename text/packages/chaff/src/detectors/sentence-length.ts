import { lengthOf, proseText } from "../measure.ts";
import type { Detector, Finding } from "../plugin.ts";

export const sentenceLength: Detector = (doc, options): Finding[] =>
  doc.sentences
    .map((sentence) => ({ sentence, size: lengthOf(sentence, doc.lengthUnit) }))
    .filter(({ size }) => size > options.limit)
    .map(({ sentence, size }) => ({
      rule: "max-sentence-length",
      severity: "warning",
      line: 0,
      column: 0,
      quote: proseText(sentence),
      values: { count: size, limit: options.limit, offset: sentence.span.start },
    }));
