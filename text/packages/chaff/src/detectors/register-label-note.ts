import type { Sentence } from "../plugin.ts";
import type { Register } from "./register.ts";

// A list item that opens with a bold label closed by a colon, then a short note in one register, then prose in the other
// (- **外付けHDDが見つからない**：誰かが抜いたか、マウントされていない。差し直すとたいてい直ります。). The note is written as a
// field's value, the way a list of troubles notes a cause, and the item's own prose is the writer's register. Pure.

/** The head of a list item: its mark, a bold label, the closing bold, and a colon. */
const LABEL_HEAD = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\*\*|__)[^*_\n]+(?:\*\*|__)[ \t]*[:：]/u;

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

/** The sentence opens the item's line right after a bold label and a colon. */
const opensAfterLabel = (sentences: readonly Sentence[], index: number, source: string): boolean => {
  const sentence = sentences[index];
  if (sentence === undefined) return false;
  const lineStart = lineStartOf(source, sentence.span.start);
  const before = sentences[index - 1];
  if (before !== undefined && before.span.end > lineStart) return false;
  const head = LABEL_HEAD.exec(source.slice(lineStart, sentence.span.end));
  return head !== null && lineStart + head[0].length > sentence.span.start;
};

/**
 * The note sentences of such items: the first sentence after the label, when the next sentence goes on in the same item, on
 * the same line, in the other register.
 */
export const labelNoteSentences = (sentences: readonly Sentence[], source: string, registerAt: (sentence: Sentence) => Register | undefined): Set<Sentence> =>
  new Set(
    sentences.filter((sentence, index) => {
      const next = sentences[index + 1];
      if (next === undefined || source.slice(sentence.span.end, next.span.start).includes("\n")) return false;
      const own = registerAt(sentence);
      const following = registerAt(next);
      return own !== undefined && following !== undefined && own !== following && opensAfterLabel(sentences, index, source);
    }),
  );
