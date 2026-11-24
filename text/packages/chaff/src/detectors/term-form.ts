import type { Detector, Finding } from "../plugin.ts";
import { termVariants } from "../term-form.ts";

/** The terms the team lists under terms in chaff.yaml, written in another case, width, hyphenation or spacing. Nothing listed, nothing said. */
export const termForm: Detector = (doc, options): Finding[] => {
  const terms = (options.lexicon ?? []).map((entry) => entry.pattern);
  const hits = doc.sentences.flatMap((sentence) => termVariants(sentence.text, terms).map((variant) => ({ sentence, variant })));
  if (hits.length === 0 || hits.length < options.limit) return [];
  return hits.map(({ sentence, variant }) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: sentence.text.trim(),
    values: { matched: variant.written, preferred: variant.term, count: hits.length, limit: options.limit, offset: sentence.span.start + variant.span.start },
  }));
};
