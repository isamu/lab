import type { Detector, Finding, Lexicon, LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";
import { comparableText, comparableWords, entryIn, entryRanges } from "./lexicon-match.ts";

// Requirements smells (Femmer et al. 2017; Berry et al. 2003; ISO/IEC/IEEE 29148): a loophole, an open-ended list and
// "and/or", in a sentence that states a requirement. What makes a sentence a requirement, and each smell's words, come
// from the language's lexicons; this file knows neither language.

/** Each smell: the lexicon of its words, and the finding's variant (the rule's messages). */
const SMELLS = [
  { lexicon: "requirement-loophole", variant: "loophole" },
  { lexicon: "requirement-open-end", variant: "open-end" },
  { lexicon: "requirement-either", variant: "either" },
] as const;

const MARKERS = "requirement-marker";
/** Sentence ends that look like a marker and are not one (「…のこと。」 defines a term). The language may have none. */
const NOT_MARKERS = "requirement-not-marker";

/** Marks and closing brackets that may follow the last word of a sentence (こと。」, must.). */
const TRAILING_MARKS = new Set([..." \t\n。．.!！?？」』)）\"'”’"]);

const withoutTrailingMarks = (text: string): string => {
  const chars = [...text];
  return chars.slice(0, chars.findLastIndex((char) => !TRAILING_MARKS.has(char)) + 1).join("");
};

/** Whether the sentence ends with the entry, past its closing marks. */
const closesWith = (sentence: Sentence, entry: LexiconEntry): boolean =>
  withoutTrailingMarks(comparableText(sentence)).endsWith(comparableWords(entry.pattern));

/** A marker with position: after counts only at the end of the sentence (「…できること。」); any other, anywhere in it. */
const isMarkedBy = (sentence: Sentence, entry: LexiconEntry): boolean => (entry.position === "after" ? closesWith(sentence, entry) : entryIn(sentence, entry));

export const isRequirement = (sentence: Sentence, markers: Lexicon, notMarkers: Lexicon): boolean =>
  markers.some((entry) => isMarkedBy(sentence, entry)) && !notMarkers.some((entry) => isMarkedBy(sentence, entry));

/** Where in the document the word starts: its first token, or the sentence when there are no tokens. */
const offsetOf = (sentence: Sentence, entry: LexiconEntry): number => {
  const range = entryRanges(sentence, entry)[0];
  return range === undefined ? sentence.span.start : (sentence.tokens?.[range.start]?.span.start ?? sentence.span.start);
};

const findingOf = (sentence: Sentence, entry: LexiconEntry, variant: string): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  variant,
  values: { matched: entry.pattern, offset: offsetOf(sentence, entry) },
});

/** The first word of each smell in one requirement sentence: one finding per smell, not per word. */
const smellsIn = (sentence: Sentence, lexicons: ProseDocument["lexicons"]): Finding[] =>
  SMELLS.flatMap(({ lexicon, variant }) => {
    const entry = (lexicons[lexicon] ?? []).find((candidate) => entryIn(sentence, candidate));
    return entry === undefined ? [] : [findingOf(sentence, entry, variant)];
  });

export const requirementSmell: Detector = (doc): Finding[] => {
  const markers = doc.lexicons[MARKERS] ?? [];
  const notMarkers = doc.lexicons[NOT_MARKERS] ?? [];
  return doc.sentences.filter((sentence) => isRequirement(sentence, markers, notMarkers)).flatMap((sentence) => smellsIn(sentence, doc.lexicons));
};
