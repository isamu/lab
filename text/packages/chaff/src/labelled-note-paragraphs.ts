import { escapeRegExp } from "./orthography.ts";
import type { Paragraph, Sentence } from "./plugin.ts";

// A paragraph opened by a note's label (（注1）…をもって算定。 / ※ …を計上。) is a note to a table or a figure, written in the
// clipped style of notes, not body text. Pure.

/** The paragraph-head pattern: a label word with an optional number, bracketed or closed by a bracket, a colon or a space; or a mark. */
const labelPattern = (words: readonly string[], marks: readonly string[]): RegExp | undefined => {
  const alternatives = [
    ...(words.length === 0
      ? []
      : [`[（(](?:${words.map(escapeRegExp).join("|")})[\\d０-９]{0,3}[）)]`, `(?:${words.map(escapeRegExp).join("|")})[\\d０-９]{0,3}[）)：:\\u3000 ]`]),
    ...marks.map(escapeRegExp),
  ];
  return alternatives.length === 0 ? undefined : new RegExp(`^[ \\t\\u3000]*(?:${alternatives.join("|")})`, "u");
};

/** The sentences of the paragraphs that open with a note's label. words are label words (注), marks are note marks (※). */
export const labelledNoteSentences = (
  source: string,
  paragraphs: readonly Paragraph[],
  words: readonly string[],
  marks: readonly string[],
): ReadonlySet<Sentence> => {
  const pattern = labelPattern(words, marks);
  if (pattern === undefined) return new Set();
  return new Set(
    paragraphs.filter((paragraph) => pattern.test(source.slice(paragraph.span.start, paragraph.span.end))).flatMap((paragraph) => paragraph.sentences),
  );
};
