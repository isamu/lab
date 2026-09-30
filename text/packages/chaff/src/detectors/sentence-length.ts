import { lengthOf, proseText } from "../measure.ts";
import type { Detector, DetectorOptions, Finding, LengthUnit, Sentence } from "../plugin.ts";

type Measure = { readonly size: number; readonly limit: number; readonly variant?: string };

/** 文書と違う言語の文（和文の中の英文）は、その言語の単位と上限で測る。rule がその言語の段を持たなければ文書のもので。 */
const measureOf = (sentence: Sentence, unit: LengthUnit, options: DetectorOptions): Measure => {
  const embedded = sentence.embeddedLanguage;
  const limit = embedded === undefined ? undefined : options.embeddedLimits?.[embedded.id];
  if (embedded === undefined || limit === undefined) return { size: lengthOf(sentence, unit), limit: options.limit };
  return { size: lengthOf(sentence, embedded.lengthUnit), limit, variant: `embedded-${embedded.id}` };
};

export const sentenceLength: Detector = (doc, options): Finding[] =>
  doc.sentences
    .map((sentence) => ({ sentence, measure: measureOf(sentence, doc.lengthUnit, options) }))
    .filter(({ measure }) => measure.size > measure.limit)
    .map(({ sentence, measure }) => ({
      rule: "max-sentence-length",
      severity: "warning",
      line: 0,
      column: 0,
      quote: proseText(sentence),
      values: { count: measure.size, limit: measure.limit, offset: sentence.span.start },
      ...(measure.variant === undefined ? {} : { variant: measure.variant }),
    }));
