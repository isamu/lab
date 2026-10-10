// installment-total-mismatch: a number of payments times the amount of each that is not the stated total of payments
// (structure/installment-total.ts). The amounts are currency-notation's, read with amount-multiplier's words of scale; the
// labels are installment-label, the other words installment-word, approximate-marker, number-word (digit), range-connector
// and amount-range-word.
import type { Detector, Finding, Lexicon, ProseDocument } from "../plugin.ts";
import { installmentTotalMismatches, type InstallmentAmount, type InstallmentWords, type PositionedWord } from "../structure/installment-total.ts";
import { scaledAmountOf, scaleWordsOf } from "./amount-scale.ts";
import { amountsIn, formsOf } from "./currency-notation.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";

const entriesOf = (doc: ProseDocument, lexicon: string, group?: string): Lexicon =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group);

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] => entriesOf(doc, lexicon, group).map((entry) => entry.pattern);

const markersOf = (doc: ProseDocument): PositionedWord[] =>
  entriesOf(doc, "approximate-marker").map((entry) => ({ word: entry.pattern, position: entry.position === "after" ? "after" : "before" }));

const numberWordsOf = (doc: ProseDocument): InstallmentWords["numberWords"] =>
  entriesOf(doc, "number-word", "digit").flatMap((entry) => (entry.weight === undefined ? [] : [{ word: entry.pattern, value: entry.weight }]));

const labelsOf = (doc: ProseDocument): InstallmentWords["labels"] => ({
  count: patternsOf(doc, "installment-label", "count"),
  each: patternsOf(doc, "installment-label", "each"),
  first: patternsOf(doc, "installment-label", "first"),
  last: patternsOf(doc, "installment-label", "last"),
  total: patternsOf(doc, "installment-label", "total"),
});

const wordsOf = (doc: ProseDocument): InstallmentWords => ({
  labels: labelsOf(doc),
  units: patternsOf(doc, "installment-word", "unit"),
  qualifiers: patternsOf(doc, "installment-word", "qualifier"),
  links: patternsOf(doc, "installment-word", "link"),
  per: patternsOf(doc, "installment-word", "per"),
  rounding: patternsOf(doc, "installment-word", "rounding"),
  skips: patternsOf(doc, "installment-word", "skip"),
  markers: markersOf(doc),
  connectors: [...patternsOf(doc, "range-connector"), ...patternsOf(doc, "amount-range-word")],
  numberWords: numberWordsOf(doc),
});

const amountsOf = (text: string, doc: ProseDocument): InstallmentAmount[] => {
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

export const installmentTotalMismatch: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  return installmentTotalMismatches(text, amountsOf(text, doc), wordsOf(doc)).map((issue) => ({
    rule: "installment-total-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
