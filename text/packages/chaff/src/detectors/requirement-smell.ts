import type { Detector, Finding, Lexicon, LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";
import { entryCloses, entryIn, entryRanges } from "./lexicon-match.ts";
import { openEndAt, openEndNames, type OpenEndNames } from "./open-end-names.ts";

// Requirements smells (Femmer et al. 2017; Berry et al. 2003; ISO/IEC/IEEE 29148): a loophole, an open-ended list and
// "and/or", in a sentence that states a requirement. What makes a sentence a requirement, and each smell's words, come
// from the language's lexicons; this file knows neither language.

const OPEN_END = "requirement-open-end";

/** Each smell: the lexicon of its words, and the finding's variant (the rule's messages). */
const SMELLS = [
  { lexicon: "requirement-loophole", variant: "loophole" },
  { lexicon: OPEN_END, variant: "open-end" },
  { lexicon: "requirement-either", variant: "either" },
] as const;

const MARKERS = "requirement-marker";
/** Sentence ends that look like a marker and are not one (「…のこと。」 defines a term). The language may have none. */
const NOT_MARKERS = "requirement-not-marker";
/** The language's words of a definition (をいう, means): a name defined with them closes its own list (銀行等（…をいう。）). */
const STATEMENTS = "definition-statement";

/** A marker with position: after counts only at the end of the sentence (「…できること。」); any other, anywhere in it. */
const isMarkedBy = (sentence: Sentence, entry: LexiconEntry): boolean => (entry.position === "after" ? entryCloses(sentence, entry) : entryIn(sentence, entry));

export const isRequirement = (sentence: Sentence, markers: Lexicon, notMarkers: Lexicon): boolean =>
  markers.some((entry) => isMarkedBy(sentence, entry)) && !notMarkers.some((entry) => isMarkedBy(sentence, entry));

/** Where in the document the word starts: its first token, or the sentence when there are no tokens. */
const offsetOf = (sentence: Sentence, entry: LexiconEntry): number => {
  const range = entryRanges(sentence, entry)[0];
  return range === undefined ? sentence.span.start : (sentence.tokens?.[range.start]?.span.start ?? sentence.span.start);
};

const findingOf = (sentence: Sentence, entry: LexiconEntry, variant: string, offset: number): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  variant,
  values: { matched: entry.pattern, offset },
});

/** Where the word stands as a smell. An open-end word inside a name the document gives (業務執行取締役等) is none; without tokens it cannot be told apart. */
const smellAt = (doc: ProseDocument, sentence: Sentence, entry: LexiconEntry, lexicon: string, names: () => OpenEndNames): number | undefined => {
  if (!entryIn(sentence, entry)) return undefined;
  const tokenized = sentence.tokens !== undefined && (entry.tokens?.length ?? 0) > 0;
  return lexicon === OPEN_END && tokenized ? openEndAt(doc, sentence, entry, names()) : offsetOf(sentence, entry);
};

/** The first word of each smell in one requirement sentence: one finding per smell, not per word. */
const smellsIn = (doc: ProseDocument, sentence: Sentence, names: () => OpenEndNames): Finding[] =>
  SMELLS.flatMap(({ lexicon, variant }) =>
    (doc.lexicons[lexicon] ?? [])
      .flatMap((entry) => {
        const offset = smellAt(doc, sentence, entry, lexicon, names);
        return offset === undefined ? [] : [findingOf(sentence, entry, variant, offset)];
      })
      .slice(0, 1),
  );

export const requirementSmell: Detector = (doc): Finding[] => {
  const markers = doc.lexicons[MARKERS] ?? [];
  const notMarkers = doc.lexicons[NOT_MARKERS] ?? [];
  const statements = (doc.lexicons[STATEMENTS] ?? []).map((entry) => entry.pattern);
  // Read once, and only when a requirement has an open-end word to tell apart from a name.
  const cache: { names?: OpenEndNames } = {};
  const names = (): OpenEndNames => (cache.names ??= openEndNames(doc, doc.lexicons[OPEN_END] ?? [], statements));
  return doc.sentences.filter((sentence) => isRequirement(sentence, markers, notMarkers)).flatMap((sentence) => smellsIn(doc, sentence, names));
};
