import type { ProseDocument } from "../plugin.ts";
import type { TotalWords } from "../structure/prose-total.ts";

const patternsOf = (doc: ProseDocument, id: string, group?: string): string[] =>
  (doc.lexicons[id] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

/** total-mismatch が文の中の合計と内訳を読む語。言語パッケージの語彙表から取る。 */
export const proseTotalWordsOf = (doc: ProseDocument): TotalWords => ({
  totals: patternsOf(doc, "total-phrase"),
  breakdowns: patternsOf(doc, "breakdown-phrase"),
  discounts: patternsOf(doc, "discount-word"),
  joiners: patternsOf(doc, "breakdown-gap-joiner"),
  leads: patternsOf(doc, "total-breakdown-lead"),
  partials: patternsOf(doc, "breakdown-partial-word"),
  mainOnly: patternsOf(doc, "breakdown-partial-word", "main"),
  backReferences: patternsOf(doc, "total-back-reference"),
  roundedUnits: patternsOf(doc, "rounded-amount-unit"),
});
