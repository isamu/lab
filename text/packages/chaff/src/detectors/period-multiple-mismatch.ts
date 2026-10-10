// period-multiple-mismatch: an amount stated as a number of another period's amount (月払の12か月分, 12 monthly payments)
// that is not that many of it (structure/period-multiple.ts). The amounts are currency-notation's, read with
// amount-multiplier's words of scale; the base labels are period-multiple-label, the words period-multiple-word, the counts
// number-word (digit), and a range of counts is joined by range-connector or amount-range-word.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { periodMultipleMismatches, type PeriodMultipleWords } from "../structure/period-multiple.ts";
import type { StatedAmount } from "../structure/stated-multiple.ts";
import { scaledAmountOf, scaleWordsOf } from "./amount-scale.ts";
import { amountsIn, formsOf } from "./currency-notation.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group).map((entry) => entry.pattern);

const numberWordsOf = (doc: ProseDocument): PeriodMultipleWords["numberWords"] =>
  (doc.lexicons["number-word"] ?? []).flatMap((entry) =>
    entry.group === "digit" && entry.weight !== undefined ? [{ word: entry.pattern, value: entry.weight }] : [],
  );

const wordsOf = (doc: ProseDocument): PeriodMultipleWords => ({
  bases: patternsOf(doc, "period-multiple-label"),
  times: patternsOf(doc, "period-multiple-word", "times"),
  links: patternsOf(doc, "period-multiple-word", "link"),
  skips: patternsOf(doc, "period-multiple-word", "skip"),
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

export const periodMultipleMismatch: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  return periodMultipleMismatches(text, amountsOf(text, doc), wordsOf(doc)).map((issue) => ({
    rule: "period-multiple-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
