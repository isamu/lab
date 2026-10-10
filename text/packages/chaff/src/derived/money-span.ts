import type { Span } from "../plugin.ts";

/** A currency mark from the currency-notation lexicon and the side of the number it is written on. */
export type CurrencyMark = { readonly pattern: string; readonly before: boolean };

/** Whether the amount at span is money: a currency mark right before its number (¥1,000, $5) or as its unit (3,000円, 10 USD). */
export const isMoneySpan = (text: string, span: Span, unit: string, marks: readonly CurrencyMark[]): boolean => {
  const before = text.slice(0, span.start).trimEnd();
  return marks.some((mark) => (mark.before ? before.endsWith(mark.pattern) : unit === mark.pattern));
};
