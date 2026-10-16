import type { LexiconEntry, Sentence } from "../plugin.ts";

// An open list right before a question that asks the reader to choose (…措置など、どのような措置を求めるのかを記載する):
// the list gives example answers, and leaving it open is the point. The question's words come from the language's
// requirement-open-question lexicon. Pure.

const INTERROGATIVE = "interrogative";
const QUESTION_END = "question-end";
/** Words that start like an interrogative and ask how instead (どのように), which offers no list of answers. */
const NOT_INTERROGATIVE = "not-interrogative";
/** A particle that turns the interrogative into "any" (どの部署でも, 何をも): no question follows. */
const UNIVERSAL_MARK = "universal-mark";
/** The marks that may stand between the list's last word and the question (、). */
const LINK = /^[\s、，,]*/u;
const PARTICLE = "PART";

export type QuestionWords = {
  readonly interrogatives: readonly string[];
  readonly notInterrogatives: readonly string[];
  readonly ends: ReadonlySet<string>;
  readonly universalMarks: ReadonlySet<string>;
};

const patternsIn = (entries: readonly LexiconEntry[], group: string): string[] =>
  entries.filter((entry) => entry.group === group && entry.pattern !== "").map((entry) => entry.pattern);

export const questionWordsOf = (entries: readonly LexiconEntry[]): QuestionWords => ({
  interrogatives: patternsIn(entries, INTERROGATIVE),
  notInterrogatives: patternsIn(entries, NOT_INTERROGATIVE),
  ends: new Set(patternsIn(entries, QUESTION_END)),
  universalMarks: new Set(patternsIn(entries, UNIVERSAL_MARK)),
});

/**
 * Whether a question starts right after the open word that ends at document offset end, and closes later in the
 * sentence with a question particle, before any particle that makes the interrogative mean "any" (どの部署でも): the list
 * before the word gives examples of what the question asks for.
 */
export const asksAfter = (sentence: Sentence, end: number, words: QuestionWords): boolean => {
  const rest = sentence.text.slice(end - sentence.span.start);
  const link = LINK.exec(rest)?.[0].length ?? 0;
  const question = rest.slice(link);
  const startsWithAny = (patterns: readonly string[]): boolean => patterns.some((word) => question.startsWith(word));
  const asks = startsWithAny(words.interrogatives) && !startsWithAny(words.notInterrogatives);
  const questionStart = end + link;
  const after = (sentence.tokens ?? []).filter((token) => token.span.start >= questionStart);
  const close = after.findIndex((token) => token.pos === PARTICLE && words.ends.has(token.surface));
  const universal = after.slice(0, close).some((token) => words.universalMarks.has(token.surface));
  return asks && close !== -1 && !universal;
};
