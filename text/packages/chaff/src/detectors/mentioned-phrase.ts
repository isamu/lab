// A phrase that is mentioned rather than used: named as a term (when saying "raise the bar", the phrase "low-hanging
// fruit", 「徹底解説」という言い方). The writer is talking about the words, not leaning on them. The cue words come from the
// language's mention-cue word list: group before stands right before the phrase, group after right after it. Pure.
import type { LexiconEntry, Sentence, Token } from "../plugin.ts";
import { entryEndsAt, entryRanges, type TokenRange } from "./lexicon-match.ts";

const BEFORE = "before";
const AFTER = "after";

/** Quote marks and brackets that may stand between the cue and the phrase ("raise the bar", 「徹底解説」). */
const QUOTE_MARKS = new Set(["'", '"', "‘", "’", "“", "”", "「", "」", "『", "』", "(", ")", "（", "）"]);

export type MentionCues = { readonly before: readonly LexiconEntry[]; readonly after: readonly LexiconEntry[] };

export const mentionCuesOf = (entries: readonly LexiconEntry[]): MentionCues => ({
  before: entries.filter((entry) => entry.group === BEFORE),
  after: entries.filter((entry) => entry.group === AFTER),
});

const isQuoteMark = (token: Token | undefined): boolean => token !== undefined && QUOTE_MARKS.has(token.surface);

/** The index past the quote marks from `at` in direction `step`. */
const pastQuotes = (tokens: readonly Token[], at: number, step: 1 | -1): number => (isQuoteMark(tokens[at]) ? pastQuotes(tokens, at + step, step) : at);

const startsAt = (tokens: readonly Token[], entry: LexiconEntry, start: number): boolean => entryEndsAt(tokens, entry, start + (entry.tokens?.length ?? 0));

const isMention = (tokens: readonly Token[], range: TokenRange, cues: MentionCues): boolean => {
  const before = pastQuotes(tokens, range.start - 1, -1) + 1;
  const after = pastQuotes(tokens, range.end, 1);
  return cues.before.some((cue) => entryEndsAt(tokens, cue, before)) || cues.after.some((cue) => startsAt(tokens, cue, after));
};

/** Whether every use of the entry in the sentence is a mention. Without tokens no use can be told apart, so none is. */
export const onlyMentioned = (sentence: Sentence, entry: LexiconEntry, cues: MentionCues): boolean => {
  const tokens = sentence.tokens;
  const ranges = entryRanges(sentence, entry);
  return tokens !== undefined && ranges.length > 0 && ranges.every((range) => isMention(tokens, range, cues));
};
