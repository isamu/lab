// deductible-exceeds-limit: the reading half. Takes the words from the lexicons deductible-word, benefit-limit-word,
// deductible-basis, approximate-marker, range-connector, currency-notation and amount-multiplier, and leaves the deciding to
// structure/deductible-limit.ts, one sentence at a time.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { quoteAt } from "./structure-tree.ts";
import { sentenceDeductibleOverLimit, type DeductibleWords } from "../structure/deductible-limit.ts";

const RULE = "deductible-exceeds-limit";
const NOT = "not";

const entriesOf = (doc: ProseDocument, id: string) => doc.lexicons[id] ?? [];
const patternsOf = (doc: ProseDocument, id: string, keep: (group: string | undefined) => boolean = () => true): string[] =>
  entriesOf(doc, id)
    .filter((entry) => keep(entry.group))
    .map((entry) => entry.pattern);
const atSide = (doc: ProseDocument, id: string, position: "before" | "after"): string[] =>
  entriesOf(doc, id)
    .filter((entry) => entry.position === position)
    .map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): DeductibleWords => ({
  deductibles: patternsOf(doc, "deductible-word", (group) => group !== NOT),
  limits: patternsOf(doc, "benefit-limit-word", (group) => group !== NOT),
  notDeductibles: patternsOf(doc, "deductible-word", (group) => group === NOT),
  notLimits: patternsOf(doc, "benefit-limit-word", (group) => group === NOT),
  bases: entriesOf(doc, "deductible-basis").flatMap((entry) =>
    entry.group === undefined ? [] : [{ pattern: entry.pattern, basis: entry.group, rank: entry.weight }],
  ),
  approximate: { before: atSide(doc, "approximate-marker", "before"), after: atSide(doc, "approximate-marker", "after") },
  rangeMarks: patternsOf(doc, "range-connector"),
  multipliers: entriesOf(doc, "amount-multiplier").flatMap((entry) => (entry.weight === undefined ? [] : [{ word: entry.pattern, value: entry.weight }])),
  amounts: {
    before: atSide(doc, "currency-notation", "before"),
    after: atSide(doc, "currency-notation", "after"),
    multipliers: patternsOf(doc, "amount-multiplier"),
    percentUnits: patternsOf(doc, "percent-unit"),
  },
  currencies: entriesOf(doc, "currency-notation").flatMap((entry) => (entry.group === undefined ? [] : [{ pattern: entry.pattern, currency: entry.group }])),
});

/** A deductible larger than the most paid for the same benefit, read in one sentence. */
export const deductibleExceedsLimit: Detector = (doc): Finding[] => {
  const words = wordsOf(doc);
  if (words.deductibles.length === 0 || words.limits.length === 0) return [];
  return doc.sentences.flatMap((sentence): Finding[] => {
    const text = doc.source.slice(sentence.span.start, sentence.span.end);
    const issue = sentenceDeductibleOverLimit(text, sentence.span.start, words);
    if (issue === undefined) return [];
    return [
      { rule: RULE, severity: "warning", line: 0, column: 0, quote: quoteAt(doc.source, issue.offset), values: { ...issue.values, offset: issue.offset } },
    ];
  });
};
