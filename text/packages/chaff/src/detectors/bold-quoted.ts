import type { Span } from "../plugin.ts";

/** The bold marks around a run. */
const BOLD_MARKS = /^(?:\*\*|__)(.*)(?:\*\*|__)$/su;

/** A quotation or a code span that is the whole run: the writer names the words, as a README marks the part of an example it means. */
const WHOLLY_QUOTED = /^(?:"[^"]+"|“[^“”]+”|'[^']+'|‘[^‘’]+’|「[^「」]+」|『[^『』]+』|`[^`]+`)$/u;

/** Whether the bold run is nothing but a quoted phrase (**"であったが"**, **`strict`**): a mention of words, not emphasis. */
export const isQuotedMention = (source: string, span: Span): boolean => {
  const inner = BOLD_MARKS.exec(source.slice(span.start, span.end))?.[1];
  return inner !== undefined && WHOLLY_QUOTED.test(inner.trim());
};
