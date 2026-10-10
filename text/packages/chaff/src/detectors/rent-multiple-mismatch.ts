// rent-multiple-mismatch: a deposit or key money given in months of rent beside an amount that is not that many months of
// the rent (structure/rent-multiple.ts). The amounts are currency-notation's, read with amount-multiplier's words of scale;
// the labels are rent-label and rent-multiple-label, the words rent-multiple-word, the counts number-word (digit), and a
// range of rent is joined by range-connector or amount-range-word.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { rentMultipleMismatches, type RentMultipleWords } from "../structure/rent-multiple.ts";
import type { StatedAmount } from "../structure/stated-multiple.ts";
import { scaledAmountOf, scaleWordsOf } from "./amount-scale.ts";
import { amountsIn, formsOf } from "./currency-notation.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

const numberWordsOf = (doc: ProseDocument): RentMultipleWords["numberWords"] =>
  (doc.lexicons["number-word"] ?? []).flatMap((entry) =>
    entry.group === "digit" && entry.weight !== undefined ? [{ word: entry.pattern, value: entry.weight }] : [],
  );

const wordsOf = (doc: ProseDocument): RentMultipleWords => ({
  rents: patternsOf(doc, "rent-label", "rent"),
  fees: patternsOf(doc, "rent-label", "fee"),
  multiples: patternsOf(doc, "rent-multiple-label"),
  months: patternsOf(doc, "rent-multiple-word", "month"),
  links: patternsOf(doc, "rent-multiple-word", "link"),
  periods: patternsOf(doc, "rent-multiple-word", "period"),
  skips: patternsOf(doc, "rent-multiple-word", "skip"),
  connectors: [...patternsOf(doc, "range-connector"), ...patternsOf(doc, "amount-range-word")],
  numberWords: numberWordsOf(doc),
});

const amountsOf = (text: string, doc: ProseDocument): StatedAmount[] => {
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

export const rentMultipleMismatch: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  return rentMultipleMismatches(text, amountsOf(text, doc), wordsOf(doc)).map((issue) => ({
    rule: "rent-multiple-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
