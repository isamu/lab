// phone-number-variant: one phone number written with two neighbouring digits swapped somewhere else in the document,
// after a label of the same kind (phone-numbers.ts).
import { labelledPhoneNumbers, phoneVariants } from "../phone-numbers.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding } from "../plugin.ts";

export const phoneNumberVariant: Detector = (doc, options): Finding[] => {
  const labels = options.lexicon ?? [];
  if (labels.length === 0) return [];
  return phoneVariants(labelledPhoneNumbers(doc.prose ?? doc.source, labels)).map(({ number, other }) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, number.offset),
    values: { written: number.written, other: other.written, offset: number.offset },
  }));
};
