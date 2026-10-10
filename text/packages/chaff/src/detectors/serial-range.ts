// serial-range-reversed: a range of serial, lot or batch codes whose end is below its start (製造番号：A2400〜A1800,
// "Lots L5240 through L5210"), decided by structure/amount-range.ts as quantity-range-reversed is. The codes are read by
// structure/serial-range.ts; serial-label names the codes on the line; the joints are range-connector, range-opener,
// range-closer and quantity-range-word; quantity-change-word's ungrouped words make a pair a change.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { reversedAmountRanges, type AmountRangeWords } from "../structure/amount-range.ts";
import { labelledRanges, NO_BARE_NUMBER, serialRangeEnds } from "../structure/serial-range.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => entry.group === undefined).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): AmountRangeWords => ({
  connectors: [...patternsOf(doc, "range-connector"), ...patternsOf(doc, "quantity-range-word")],
  openers: patternsOf(doc, "range-opener"),
  closers: patternsOf(doc, "range-closer"),
  changes: patternsOf(doc, "quantity-change-word"),
  lowers: [],
  uppers: [],
  links: [],
  scales: [],
  number: NO_BARE_NUMBER,
});

export const serialRange: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  const reversed = reversedAmountRanges(text, serialRangeEnds(text), wordsOf(doc));
  return labelledRanges(text, reversed, patternsOf(doc, "serial-label")).map((issue) => ({
    rule: "serial-range-reversed",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
