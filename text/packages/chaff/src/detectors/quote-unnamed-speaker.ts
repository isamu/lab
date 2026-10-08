// quote-unnamed-speaker: a quotation given to a role with no name (業界のアナリストは「…」と述べた, "…," said an analyst).
// The decision is in unnamed-speaker.ts.
import { speakerWords, unnamedSpeakerQuotes } from "../unnamed-speaker.ts";
import type { Detector, Finding } from "../plugin.ts";

export const quoteUnnamedSpeaker: Detector = (doc, options): Finding[] => {
  const words = speakerWords(options.lexicon ?? [], doc.lexicons["quote-attribution"] ?? []);
  return doc.paragraphs
    .flatMap((paragraph) => paragraph.sentences)
    .flatMap((sentence) => unnamedSpeakerQuotes({ start: sentence.span.start, text: sentence.text }, words))
    .map((hit) => ({
      rule: "quote-unnamed-speaker",
      severity: "info",
      line: 0,
      column: 0,
      quote: hit.quote,
      values: { quote: hit.quote, speaker: hit.speaker, offset: hit.offset },
    }));
};
