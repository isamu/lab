// period-multiple-mismatch: an amount stated as a number of another period's amount (月払の12か月分, 12 monthly payments)
// that is not that many of it (structure/period-multiple.ts). The amounts are currency-notation's, read with
// amount-multiplier's words of scale; the base labels are period-multiple-label, the words period-multiple-word, the counts
// number-word (digit), and a range of counts is joined by range-connector or amount-range-word.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { periodMultipleMismatches, type PeriodMultipleWords } from "../structure/period-multiple.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";
import { statedAmountsOf } from "./stated-amounts.ts";

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

export const periodMultipleMismatch: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  return periodMultipleMismatches(text, statedAmountsOf(text, doc), wordsOf(doc)).map((issue) => ({
    rule: "period-multiple-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
