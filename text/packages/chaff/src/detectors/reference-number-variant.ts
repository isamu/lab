// reference-number-variant: a document's own reference number written with two neighbouring characters swapped somewhere
// else in the document, after a label of the same kind (reference-numbers.ts).
import { labelledReferenceNumbers, referenceVariants } from "../reference-numbers.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding } from "../plugin.ts";

export const referenceNumberVariant: Detector = (doc, options): Finding[] => {
  const labels = options.lexicon ?? [];
  if (labels.length === 0) return [];
  return referenceVariants(labelledReferenceNumbers(doc.prose ?? doc.source, labels)).map(({ number, other }) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, number.offset),
    values: { written: number.written, other: other.written, offset: number.offset },
  }));
};
