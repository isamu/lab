import { isInterview } from "../section-levels.ts";
import type { ProseDocument, Sentence } from "../plugin.ts";

// An interview's answers are speech set down (いえ、会社からの打診でした。…だいたい見当がつく。): one speaker mixes
// polite and plain sentences as people talk, as a transcript does. The interviewer's turns (――…？) and the writer's
// introduction before the first turn are written prose and stay compared. Pure.

const LEADING_EMPHASIS = /^[\s*_]+/u;

const opensWithMark = (text: string, marks: readonly string[]): boolean => {
  const start = text.replace(LEADING_EMPHASIS, "");
  return marks.some((mark) => start.startsWith(mark));
};

/** The sentences of an interview's answers: paragraphs after the first interviewer's turn that are not turns themselves. */
export const spokenAnswerSentences = (doc: ProseDocument, marks: readonly string[]): Set<Sentence> => {
  const starts = doc.paragraphs.map((paragraph) => paragraph.span.start);
  if (!isInterview(doc.source, doc.sections, starts, marks)) return new Set();
  const isTurn = doc.paragraphs.map((paragraph) => opensWithMark(doc.source.slice(paragraph.span.start, paragraph.span.end), marks));
  const firstTurn = isTurn.indexOf(true);
  return new Set(doc.paragraphs.flatMap((paragraph, index) => (index > firstTurn && isTurn[index] === false ? paragraph.sentences : [])));
};
