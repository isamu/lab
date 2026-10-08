// amount-range-reversed: a range of amounts whose upper end is below its lower end (structure/amount-range.ts). The amounts
// are currency-notation's, read with amount-multiplier's words of scale and amount-short-scale's (k); the words of a range
// are range-connector, range-opener, range-closer and amount-range-word; amount-change-word and amount-bound-label say
// what makes a pair a change of price and what labels a bound.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { reversedAmountRanges, type AmountRangeWords, type RangeAmount } from "../structure/amount-range.ts";
import type { ScaleWord } from "../structure/amount-scale.ts";
import { scaledAmountOf, scaleWordsOf } from "./amount-scale.ts";
import { AMOUNT, amountsIn, formsOf } from "./currency-notation.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

const shortScalesOf = (doc: ProseDocument): ScaleWord[] =>
  (doc.lexicons["amount-short-scale"] ?? []).flatMap((entry) => (entry.weight === undefined ? [] : [{ word: entry.pattern, value: entry.weight }]));

const wordsOf = (doc: ProseDocument, scales: readonly ScaleWord[]): AmountRangeWords => ({
  connectors: [...patternsOf(doc, "range-connector"), ...patternsOf(doc, "amount-range-word")],
  openers: patternsOf(doc, "range-opener"),
  closers: patternsOf(doc, "range-closer"),
  changes: patternsOf(doc, "amount-change-word"),
  lowers: patternsOf(doc, "amount-bound-label", "lower"),
  uppers: patternsOf(doc, "amount-bound-label", "upper"),
  links: patternsOf(doc, "amount-bound-label", "link"),
  scales,
  number: AMOUNT,
});

const rangeAmountsOf = (text: string, doc: ProseDocument, scales: readonly ScaleWord[]): RangeAmount[] =>
  amountsIn(
    text,
    formsOf(doc),
    scales.map((scale) => scale.word),
  ).flatMap((amount) => {
    const read = scaledAmountOf(text, amount, scales);
    if (read === undefined) return [];
    const position = amount.form.startsWith("before:") ? "before" : "after";
    return [{ offset: read.offset, end: amount.offset + amount.written.length, currency: read.currency, value: read.value, scale: read.unit, position }];
  });

export const amountRange: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  const scales = [...scaleWordsOf(doc), ...shortScalesOf(doc)];
  return reversedAmountRanges(text, rangeAmountsOf(text, doc, scales), wordsOf(doc, scales)).map((issue) => ({
    rule: "amount-range-reversed",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
