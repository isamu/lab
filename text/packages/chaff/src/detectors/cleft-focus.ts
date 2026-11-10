// The focus of a cleft sentence: what it states, after the clause that only presents it (いちばん大きく変わったのは、
// 季節に気づくようになったことだ。 states 季節に気づくようになった). Pure; the topic markers and closing words come
// from the language package's cleft-frame lexicon, so a language without one has no clefts.
import type { LexiconEntry, Span } from "../plugin.ts";

const SENTENCE_END = new Set([..."。．.!?！？ \t\n\u3000"]);
const FOCUS_START = new Set([..."、，, \t\n\u3000"]);

const withoutTrailing = (text: string, marks: ReadonlySet<string>): string => {
  const chars = [...text];
  const kept = chars.findLastIndex((char) => !marks.has(char));
  return chars.slice(0, kept + 1).join("");
};

const leadingCount = (text: string, marks: ReadonlySet<string>): number => {
  const at = [...text].findIndex((char) => !marks.has(char));
  return at === -1 ? text.length : at;
};

const patternsOf = (entries: readonly LexiconEntry[], group: string): string[] =>
  entries.filter((entry) => entry.group === group).map((entry) => entry.pattern);

const firstTopicEnd = (body: string, topics: readonly string[]): number | undefined => {
  const ends = topics.flatMap((topic) => {
    const at = body.indexOf(topic);
    return at > 0 ? [at + topic.length] : [];
  });
  return ends.length === 0 ? undefined : Math.min(...ends);
};

/** The focus's offsets in `text`, when the text opens with a topic clause and ends with a closing word; otherwise undefined. */
export const cleftFocus = (text: string, entries: readonly LexiconEntry[]): Span | undefined => {
  const body = withoutTrailing(text, SENTENCE_END);
  const close = patternsOf(entries, "close").find((pattern) => body.endsWith(pattern));
  const topicEnd = firstTopicEnd(body, patternsOf(entries, "topic"));
  if (close === undefined || topicEnd === undefined) return undefined;
  const start = topicEnd + leadingCount(body.slice(topicEnd), FOCUS_START);
  const end = body.length - close.length;
  return start < end ? { start, end } : undefined;
};
