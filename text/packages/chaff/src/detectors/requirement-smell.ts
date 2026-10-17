import type { Detector, Finding, Lexicon, LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";
import { entryCloses, entryIn, entryRanges } from "./lexicon-match.ts";
import { classWordsOf, isClassCue, namesClassAfter } from "./open-end-class.ts";
import { glossesCondition } from "./open-end-condition.ts";
import { openEndAt, openEndNames, type OpenEndNames } from "./open-end-names.ts";
import { asksAfter, questionWordsOf } from "./open-end-question.ts";
import { isScopeCue, openOnPurpose, scopeWordsOf } from "./open-end-scope.ts";
import { statesConcrete } from "./vague-deadline.ts";

// Requirements smells (Femmer et al. 2017; Berry et al. 2003; ISO/IEC/IEEE 29148): a loophole, an open-ended list and
// "and/or", in a sentence that states a requirement. What makes a sentence a requirement, and each smell's words, come
// from the language's lexicons; this file knows neither language.

const OPEN_END = "requirement-open-end";
const LOOPHOLE = "requirement-loophole";
/** The words of a question that an open list gives example answers to. */
const OPEN_QUESTION = "requirement-open-question";
/** The words of a condition whose bracketed examples an open list may give. */
const OPEN_CONDITION = "requirement-open-condition";
const TIME = "time";
const CONCRETE_DEADLINE = "concrete-deadline";

/** Each smell: the lexicon of its words, and the finding's variant (the rule's messages). */
const SMELLS = [
  { lexicon: LOOPHOLE, variant: "loophole" },
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

/** A loophole about when (group: time) that the sentence bounds with a stated limit ("as soon as possible, but no later than two days after"). */
const boundedInTime = (doc: ProseDocument, sentence: Sentence, entry: LexiconEntry, lexicon: string): boolean =>
  lexicon === LOOPHOLE &&
  entry.group === TIME &&
  statesConcrete(
    { start: sentence.span.start, text: sentence.text },
    (doc.lexicons[CONCRETE_DEADLINE] ?? []).map((limit) => limit.pattern),
  );

/** A lexicon's words; the open-end lexicon also holds the cues of a class named after the list and of what holds it, which are no smell. */
const smellWords = (doc: ProseDocument, lexicon: string): LexiconEntry[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => !isClassCue(entry) && !isScopeCue(entry));

/**
 * Where the word stands as a smell. An open-end word inside a name the document gives (業務執行取締役等), giving examples
 * of a class named right after it (印刷等、二次的に利用), or ending a list a condition, a permission or a prohibition holds
 * (転載等をしてはならない), is none; without tokens none of these can be told apart.
 */
const smellAt = (doc: ProseDocument, sentence: Sentence, entry: LexiconEntry, lexicon: string, names: () => OpenEndNames): number | undefined => {
  if (!entryIn(sentence, entry) || boundedInTime(doc, sentence, entry, lexicon)) return undefined;
  const tokenized = sentence.tokens !== undefined && (entry.tokens?.length ?? 0) > 0;
  if (lexicon !== OPEN_END || !tokenized) return offsetOf(sentence, entry);
  const classWords = classWordsOf(doc.lexicons[OPEN_END] ?? []);
  const scopeWords = scopeWordsOf(doc.lexicons[OPEN_END] ?? []);
  return openEndAt(doc, sentence, entry, names(), (tokens, range) => namesClassAfter(tokens, range, classWords) || openOnPurpose(tokens, range, scopeWords));
};

/** An open list right before a question the reader answers (…措置など、どのような措置を求めるのか): its items are example answers. */
const answersQuestion = (doc: ProseDocument, sentence: Sentence, entry: LexiconEntry, lexicon: string, offset: number): boolean =>
  lexicon === OPEN_END && asksAfter(sentence, offset + entry.pattern.length, questionWordsOf(doc.lexicons[OPEN_QUESTION] ?? []));

/** An open list in brackets right after a condition word (場合（単一テーブルへの SELECT 等）): examples of when, not of what. */
const glossesConditionAt = (doc: ProseDocument, sentence: Sentence, lexicon: string, offset: number): boolean =>
  lexicon === OPEN_END &&
  glossesCondition(
    sentence,
    offset,
    (doc.lexicons[OPEN_CONDITION] ?? []).map((entry) => entry.pattern),
  );

/** The first word of each smell in one requirement sentence: one finding per smell, not per word. */
const smellsIn = (doc: ProseDocument, sentence: Sentence, names: () => OpenEndNames): Finding[] =>
  SMELLS.flatMap(({ lexicon, variant }) =>
    smellWords(doc, lexicon)
      .flatMap((entry) => {
        const offset = smellAt(doc, sentence, entry, lexicon, names);
        const examples = offset !== undefined && (answersQuestion(doc, sentence, entry, lexicon, offset) || glossesConditionAt(doc, sentence, lexicon, offset));
        return offset === undefined || examples ? [] : [findingOf(sentence, entry, variant, offset)];
      })
      .slice(0, 1),
  );

export const requirementSmell: Detector = (doc): Finding[] => {
  const markers = doc.lexicons[MARKERS] ?? [];
  const notMarkers = doc.lexicons[NOT_MARKERS] ?? [];
  const statements = (doc.lexicons[STATEMENTS] ?? []).map((entry) => entry.pattern);
  // Read once, and only when a requirement has an open-end word to tell apart from a name.
  const cache: { names?: OpenEndNames } = {};
  const names = (): OpenEndNames => (cache.names ??= openEndNames(doc, smellWords(doc, OPEN_END), statements));
  return doc.sentences.filter((sentence) => isRequirement(sentence, markers, notMarkers)).flatMap((sentence) => smellsIn(doc, sentence, names));
};
