// Whether inline code stands right before a place in the text. Code is masked to blanks before the text is read, so a word
// after `explain` looks like the head of a sentence, and より after `relaxed` looks like the adverb. Pure.

/**
 * Whether the last mark before offset on the same line, past spaces, closes inline code (`relaxed` より). prose is the
 * source with code masked; a backtick it keeps (\` escaped, or one left unclosed) is text, not code.
 */
export const followsInlineCode = (source: string, prose: string | undefined, offset: number): boolean => {
  if (prose === undefined) return false;
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const before = source.slice(lineStart, Math.max(lineStart, offset)).trimEnd();
  const mark = lineStart + before.length - 1;
  return before.endsWith("`") && prose.charAt(mark) !== "`";
};
