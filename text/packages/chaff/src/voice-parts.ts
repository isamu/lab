import type { Span } from "./plugin.ts";

/**
 * Where each separate voice of a document starts: every sentence that opens one (裁判官甲の反対意見は、次のとおりである。).
 * A judgment's separate opinions are written by different justices, each in a spelling of their own.
 */
export const voiceStarts = (sentences: readonly { readonly span: Span; readonly text: string }[], openings: readonly RegExp[]): number[] =>
  openings.length === 0 ? [] : sentences.filter((sentence) => openings.some((opening) => opening.test(sentence.text))).map((sentence) => sentence.span.start);

/** Which voice a place is in: how many voices opened at or before it. 0 is the text before the first. */
export const voiceAt = (starts: readonly number[], offset: number): number => starts.filter((start) => start <= offset).length;
