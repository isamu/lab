import { lengthOf, proseText } from "../measure.ts";
import type { Detector, DetectorOptions, Finding, LengthUnit, Sentence } from "../plugin.ts";
import { citationLead } from "./citation-sentence.ts";
import { pageMarkerPattern, pageMarkerSize } from "./page-marker.ts";

type Measure = { readonly size: number; readonly limit: number; readonly variant?: string };

/** The page markers' pattern and the citation signals ("see"), read once per document. */
type SentenceWords = { readonly markers: RegExp | undefined; readonly citationSignals: readonly string[] };

const sizeOf = (text: string, unit: LengthUnit): number =>
  unit === "word" ? text.split(/\s+/u).filter((word) => word.length > 0).length : text.replace(/\s+/gu, "").length;

/**
 * 文書と違う言語の文（和文の中の英文）は、その言語の単位と上限で測る。rule がその言語の段を持たなければ文書のもので。
 * 印刷版のページの印（( printed page 52044)）は文の言葉ではないので数えない。
 * 脚注の文献の記載（著者 (2025), "題," …）も書き手の文ではないので、その前に書き手が置いた言葉（For example, see …）だけを測る。
 */
const measureOf = (sentence: Sentence, unit: LengthUnit, options: DetectorOptions, words: SentenceWords): Measure => {
  const lead = citationLead(proseText(sentence), words.citationSignals);
  if (lead !== undefined) return { size: sizeOf(lead, unit), limit: options.limit };
  const embedded = sentence.embeddedLanguage;
  const limit = embedded === undefined ? undefined : options.embeddedLimits?.[embedded.id];
  if (embedded === undefined || limit === undefined) {
    return { size: lengthOf(sentence, unit) - pageMarkerSize(proseText(sentence), words.markers, unit), limit: options.limit };
  }
  return { size: lengthOf(sentence, embedded.lengthUnit), limit, variant: `embedded-${embedded.id}` };
};

export const sentenceLength: Detector = (doc, options): Finding[] => {
  const words: SentenceWords = {
    markers: pageMarkerPattern((options.lexicon ?? []).map((entry) => entry.pattern)),
    citationSignals: (doc.lexicons["citation-signal"] ?? []).map((entry) => entry.pattern),
  };
  return doc.sentences
    .map((sentence) => ({ sentence, measure: measureOf(sentence, doc.lengthUnit, options, words) }))
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
};
