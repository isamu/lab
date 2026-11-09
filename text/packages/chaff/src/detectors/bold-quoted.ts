import type { Span } from "../plugin.ts";

/** The bold marks around a run. */
const BOLD_MARKS = /^(?:\*\*|__)(.*)(?:\*\*|__)$/su;

/** Each opening quote mark or backtick, with the mark that closes it. */
const CLOSING: Readonly<Record<string, string>> = { '"': '"', "“": "”", "'": "'", "‘": "’", "「": "」", "『": "』", "`": "`" };

/** A quotation or a code span that is the whole run: the writer names the words, as a README marks the part of an example it means. */
const isWhollyQuoted = (text: string): boolean => {
  const chars = Array.from(text);
  const close = CLOSING[chars[0] ?? ""];
  const inside = chars.slice(1, -1);
  return close !== undefined && chars.length > 2 && chars.at(-1) === close && !inside.includes(close) && !inside.includes(chars[0] ?? "");
};

/** Whether the bold run is nothing but a quoted phrase (**"であったが"**, **`strict`**): a mention of words, not emphasis. */
export const isQuotedMention = (source: string, span: Span): boolean => {
  const inner = BOLD_MARKS.exec(source.slice(span.start, span.end))?.[1];
  return inner !== undefined && isWhollyQuoted(inner.trim());
};
