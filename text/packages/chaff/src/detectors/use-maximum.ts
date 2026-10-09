import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";
import { exceededMaxima } from "../derived/use-maximum.ts";
import { paragraphsOf } from "../derived/period-counts.ts";
import { limitWordsOf, marksOf, periodCountWordsOf } from "./use-count-words.ts";
import { quoteAt } from "./structure-tree.ts";

// 1回の量 × 期間あたりの回数が、その期間の上限を超える（product-exceeds-maximum）。語は use-count-word と use-amount-word から取る。

const written = (doc: ProseDocument, span: Span): string => doc.source.slice(span.start, span.end);

const LEADING_NUMBER = /^[\p{Nd}.,．，]+\s?/u;

export const productExceedsMaximum: Detector = (doc): Finding[] => {
  const words = { ...periodCountWordsOf(doc), ...limitWordsOf(doc), perUse: marksOf(doc, "use-amount-word") };
  return exceededMaxima(doc.source, paragraphsOf(doc.source), words).map((exceeded) => ({
    rule: "product-exceeds-maximum",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, exceeded.maximum.start),
    values: {
      amount: written(doc, exceeded.perUse),
      count: written(doc, exceeded.count),
      maximum: written(doc, exceeded.maximum),
      expected: exceeded.expected,
      unit: written(doc, exceeded.maximum).replace(LEADING_NUMBER, ""),
      offset: exceeded.maximum.start,
    },
  }));
};
