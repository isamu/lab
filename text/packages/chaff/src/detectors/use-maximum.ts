import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";
import { exceededMaxima } from "../derived/use-maximum.ts";
import { paragraphsOf } from "../derived/period-counts.ts";
import { limitWordsOf, marksOf, periodCountWordsOf } from "./use-count-words.ts";
import { quoteAt } from "./structure-tree.ts";
import { isMoneySpan, type CurrencyMark } from "../derived/money-span.ts";

// 1回の量 × 期間あたりの回数が、その期間の上限を超える（product-exceeds-maximum）。語は use-count-word と use-amount-word から取る。

const written = (doc: ProseDocument, span: Span): string => doc.source.slice(span.start, span.end);

const LEADING_NUMBER = /^[\p{Nd}.,．，]+\s?/u;

const currencyMarksOf = (doc: ProseDocument): CurrencyMark[] =>
  (doc.lexicons["currency-notation"] ?? []).map((entry) => ({ pattern: entry.pattern, before: entry.position === "before" }));

export const productExceedsMaximum: Detector = (doc): Finding[] => {
  const words = { ...periodCountWordsOf(doc), ...limitWordsOf(doc), perUse: marksOf(doc, "use-amount-word") };
  const marks = currencyMarksOf(doc);
  const unitOf = (span: Span): string => written(doc, span).replace(LEADING_NUMBER, "");
  const isMoney = (span: Span): boolean => isMoneySpan(doc.source, span, unitOf(span), marks);
  const amounts = exceededMaxima(doc.source, paragraphsOf(doc.source), words).filter((exceeded) => !isMoney(exceeded.maximum) && !isMoney(exceeded.perUse));
  return amounts.map((exceeded) => ({
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
      unit: unitOf(exceeded.maximum),
      offset: exceeded.maximum.start,
    },
  }));
};
