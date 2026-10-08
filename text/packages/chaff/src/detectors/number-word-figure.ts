// number-word-figure-mismatch: a number in words and its figure in brackets disagree (structure/number-word-figure.ts).
// The number words are the lexicon number-word; the marks around the figure are currency-notation's and the unit words of
// number-word; the words of scale inside the bracket ($5 million) are amount-multiplier's.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { wordFigureSlips, type NumberVocabulary, type NumberWord, type NumberWordKind } from "../structure/number-word-figure.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";

const KINDS: readonly NumberWordKind[] = ["digit", "place", "scale", "joiner", "lead", "unit"];

const numberWordsOf = (doc: ProseDocument): NumberWord[] =>
  (doc.lexicons["number-word"] ?? []).flatMap((entry) => {
    const kind = KINDS.find((candidate) => candidate === entry.group);
    return kind === undefined ? [] : [{ word: entry.pattern, kind, value: entry.weight ?? 0 }];
  });

export const vocabularyOf = (doc: ProseDocument): NumberVocabulary => {
  const words = numberWordsOf(doc);
  const currencies = doc.lexicons["currency-notation"] ?? [];
  const units = words.filter((word) => word.kind === "unit").map((word) => word.word);
  return {
    words,
    marksBefore: currencies.filter((entry) => entry.position === "before").map((entry) => entry.pattern),
    marksAfter: [...currencies.filter((entry) => entry.position === "after").map((entry) => entry.pattern), ...units],
    multipliers: (doc.lexicons["amount-multiplier"] ?? []).flatMap((entry) =>
      entry.weight === undefined ? [] : [{ word: entry.pattern, value: entry.weight }],
    ),
  };
};

const NUMBER_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const numberWordFigure: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  return wordFigureSlips(text, vocabularyOf(doc)).map((slip) => ({
    rule: "number-word-figure-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, slip.offset, slip.end),
    values: { written: slip.written, words: NUMBER_FORMAT.format(slip.words), figure: NUMBER_FORMAT.format(slip.figure), offset: slip.offset },
  }));
};
