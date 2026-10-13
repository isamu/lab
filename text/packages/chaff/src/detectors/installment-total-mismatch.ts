// installment-total-mismatch: a number of payments times the amount of each that is not the stated total of payments
// (structure/installment-total.ts). The amounts are currency-notation's, read with amount-multiplier's words of scale; the
// labels are installment-label, the other words installment-word, approximate-marker, number-word (digit), range-connector
// and amount-range-word.
import type { Detector, Finding, Lexicon, ProseDocument } from "../plugin.ts";
import { installmentFeeMismatches, type InstallmentSeriesWords } from "../structure/installment-fee.ts";
import { installmentTotalMismatches, type InstallmentWords, type PositionedWord } from "../structure/installment-total.ts";
import type { StructureIssue } from "../structure/issues.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";
import { statedAmountsOf } from "./stated-amounts.ts";

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

const weightedOf = (doc: ProseDocument, lexicon: string, group: string): InstallmentSeriesWords["ordinals"] =>
  entriesOf(doc, lexicon, group).flatMap((entry) => (entry.weight === undefined ? [] : [{ word: entry.pattern, value: entry.weight }]));

const seriesWordsOf = (doc: ProseDocument): InstallmentSeriesWords => ({
  numbered: patternsOf(doc, "installment-label", "numbered"),
  finals: patternsOf(doc, "installment-label", "final"),
  deposits: patternsOf(doc, "installment-label", "deposit"),
  ordinals: [...weightedOf(doc, "installment-word", "ordinal"), ...numberWordsOf(doc)],
  ordinalSuffixes: [...new Set(patternsOf(doc, "ordinal-suffix"))],
  payments: patternsOf(doc, "installment-word", "payment"),
  fees: patternsOf(doc, "installment-word", "fee"),
  feeLinks: patternsOf(doc, "installment-word", "fee-link"),
});

const findingOf = (text: string, issue: StructureIssue, variant?: string): Finding => ({
  rule: "installment-total-mismatch",
  severity: "warning",
  line: 0,
  column: 0,
  quote: quoteAround(text, issue.offset),
  values: { ...issue.values, offset: issue.offset },
  ...(variant === undefined ? {} : { variant }),
});

export const installmentTotalMismatch: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  const amounts = statedAmountsOf(text, doc);
  const words = wordsOf(doc);
  const loans = installmentTotalMismatches(text, amounts, words);
  const headings = (doc.markup?.headings ?? []).map((heading) => heading.start);
  const fees = installmentFeeMismatches(text, amounts, headings, words, seriesWordsOf(doc)).filter(
    (issue) => !loans.some((loan) => loan.offset === issue.offset),
  );
  return [...loans.map((issue) => findingOf(text, issue)), ...fees.map((issue) => findingOf(text, issue, "fee"))];
};
