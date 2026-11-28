import type { Span } from "../plugin.ts";

/** The bold marks around a run, and a colon inside them or right after (**Date:** or **Date**:). */
const LABEL = /^(?:\*\*|__)([^*_\n]+?)[:：]?(?:\*\*|__)$/u;
const COLON_AFTER = /^[:：]/u;
const COLON_INSIDE = /[:：]$/u;

/** A field label is a name, not a sentence: a few words at most (Date, Also present, Prepared by). */
const LABEL_WORDS = 4;
const LABEL_CHARS = 12;

const LATIN_WORD = /^\p{Script=Latin}+$/u;

const isShortLabel = (text: string): boolean => {
  const words = text.trim().split(/\s+/u);
  if (words.length > 1) return words.length <= LABEL_WORDS;
  const word = words[0] ?? "";
  return LATIN_WORD.test(word) || Array.from(word).length <= LABEL_CHARS;
};

/**
 * Whether the bold run is a field label opening a line of its own (**Date:** Tuesday, **Motion:** To approve): the name of
 * the value after it, as a memo or minutes header writes it, not emphasis. A label opening a list item is left counted: a
 * list of bold labels is the shape bold-label-list reads, and its density is what stands out.
 */
export const isFieldLabel = (source: string, span: Span): boolean => {
  const lineStart = source.lastIndexOf("\n", span.start - 1) + 1;
  if (source.slice(lineStart, span.start).trim() !== "") return false;
  const run = source.slice(span.start, span.end);
  const inner = LABEL.exec(run)?.[1];
  if (inner === undefined || !isShortLabel(inner)) return false;
  return COLON_INSIDE.test(run.slice(0, -2)) || COLON_AFTER.test(source.slice(span.end));
};
