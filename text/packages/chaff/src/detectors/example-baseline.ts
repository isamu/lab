import type { Span } from "../plugin.ts";

// A comparison right after two examples in code blocks ("This is much better!" after a rewritten function) compares the
// second with the first: the baseline is the example shown before, which no sentence names. So does one right after an
// example whose comment names the behaviour before ("Used to error, now doesn't."). Pure.

/** A line that opens or closes a fenced code block. */
const FENCE = /^[ \t]*(?:```|~~~)/mu;

/** How many sentences back the earlier example may stand: one sentence often introduces the second example. */
const EXAMPLE_REACH = 2;

const fenceBetween = (source: string, before: Span | undefined, after: Span | undefined): boolean =>
  before !== undefined && after !== undefined && FENCE.test(source.slice(before.end, after.start));

/** A Markdown heading line: the examples before it belong to another section. */
const HEADING = /^[ \t]*#{1,6}[ \t]/mu;

/** No heading stands between the earlier example (before the sentence at index) and the sentence at `at`. */
const sameSection = (source: string, spans: readonly Span[], index: number, at: number): boolean =>
  !HEADING.test(source.slice(spans[index - 1]?.end ?? 0, spans[at]?.start ?? 0));

/**
 * The sentence at `at` comes right after a code block, and another code block stands within EXAMPLE_REACH sentences
 * before that one, in the same section. spans are the document's sentences in order, in source offsets.
 */
export const followsTwoExamples = (source: string, spans: readonly Span[], at: number): boolean => {
  if (!fenceBetween(source, spans[at - 1], spans[at])) return false;
  return Array.from({ length: EXAMPLE_REACH }, (_, back) => at - 1 - back).some(
    (index) => fenceBetween(source, spans[index - 1], spans[index]) && sameSection(source, spans, index, at),
  );
};

/** The words of a text in lower case, each set off by one space on both sides, so a phrase is matched as whole words. */
const spacedWords = (text: string): string => ` ${(text.toLowerCase().match(/[a-z]+/gu) ?? []).join(" ")} `;

/**
 * The sentence at `at` comes right after a code block whose text names a baseline ("// Used to error, now doesn't."):
 * the example shows the behaviour before beside the one after, so "This behavior is more desirable" has its baseline.
 */
export const followsExampleNaming = (source: string, spans: readonly Span[], at: number, baselines: readonly string[]): boolean => {
  const [before, after] = [spans[at - 1], spans[at]];
  if (!fenceBetween(source, before, after) || before === undefined || after === undefined) return false;
  const words = spacedWords(source.slice(before.end, after.start));
  return baselines.some((baseline) => words.includes(` ${baseline} `));
};
