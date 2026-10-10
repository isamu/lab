// annual-pay-mismatch: an example annual pay that is not the monthly pay times twelve plus the bonus months
// (structure/annual-pay.ts). The amounts are currency-notation's, read with amount-multiplier's words of scale; the labels
// are annual-pay-label, the other words annual-pay-word, approximate-marker, duration-month, number-word (digit),
// range-connector and amount-range-word.
import type { Detector, Finding, Lexicon, ProseDocument } from "../plugin.ts";
import { annualPayMismatches, type AnnualPayWords, type PayAmount, type PositionedWord } from "../structure/annual-pay.ts";
import { scaledAmountOf, scaleWordsOf } from "./amount-scale.ts";
import { amountsIn, formsOf } from "./currency-notation.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";

const entriesOf = (doc: ProseDocument, lexicon: string, group?: string): Lexicon =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group);

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] => entriesOf(doc, lexicon, group).map((entry) => entry.pattern);

const positionedOf = (doc: ProseDocument, lexicon: string, group?: string): PositionedWord[] =>
  entriesOf(doc, lexicon, group).map((entry) => ({ word: entry.pattern, position: entry.position === "after" ? "after" : "before" }));

const numberWordsOf = (doc: ProseDocument): AnnualPayWords["numberWords"] =>
  entriesOf(doc, "number-word", "digit").flatMap((entry) => (entry.weight === undefined ? [] : [{ word: entry.pattern, value: entry.weight }]));

const labelsOf = (doc: ProseDocument): AnnualPayWords["labels"] => ({
  example: patternsOf(doc, "annual-pay-label", "example"),
  salary: patternsOf(doc, "annual-pay-label", "salary"),
  monthly: patternsOf(doc, "annual-pay-label", "monthly"),
  pay: patternsOf(doc, "annual-pay-label", "pay"),
  bonus: patternsOf(doc, "annual-pay-label", "bonus"),
});

const wordsOf = (doc: ProseDocument): AnnualPayWords => ({
  labels: labelsOf(doc),
  links: patternsOf(doc, "annual-pay-word", "link"),
  perMonth: patternsOf(doc, "annual-pay-word", "per-month"),
  none: positionedOf(doc, "annual-pay-word", "none"),
  each: patternsOf(doc, "annual-pay-word", "each"),
  extra: patternsOf(doc, "annual-pay-word", "extra"),
  times: patternsOf(doc, "annual-pay-word", "times"),
  totals: patternsOf(doc, "annual-pay-word", "total"),
  includes: patternsOf(doc, "annual-pay-word", "include"),
  markers: [...positionedOf(doc, "approximate-marker"), ...positionedOf(doc, "annual-pay-word", "open")],
  months: patternsOf(doc, "duration-month"),
  connectors: [...patternsOf(doc, "range-connector"), ...patternsOf(doc, "amount-range-word")],
  numberWords: numberWordsOf(doc),
});

const amountsOf = (text: string, doc: ProseDocument): PayAmount[] => {
  const scales = scaleWordsOf(doc);
  return amountsIn(
    text,
    formsOf(doc),
    scales.map((scale) => scale.word),
  ).flatMap((amount) => {
    const read = scaledAmountOf(text, amount, scales);
    return read === undefined
      ? []
      : [{ offset: read.offset, end: amount.offset + amount.written.length, currency: read.currency, value: read.value, scale: read.unit }];
  });
};

export const annualPayMismatch: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  return annualPayMismatches(text, amountsOf(text, doc), wordsOf(doc)).map((issue) => ({
    rule: "annual-pay-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
