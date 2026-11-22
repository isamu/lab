import type { Sentence } from "../plugin.ts";

const HASHTAG_MARK = "#";
const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

/** A word written as a hashtag (#vimconf): spelled as the service matches it, like an address. */
export const isHashtag = (text: string, start: number): boolean => text.charAt(start - 1) === HASHTAG_MARK && !WORD_CHARACTER.test(text.charAt(start - 2));

/** A link's brackets and where it goes (`[`, `](#contentType)`, `][ref]`). The prose hides them outside tables; a cell keeps the Markdown as written. */
const LINK_CHROME = /\]\([^)]*\)|\]\[[^\]]*\]|\[/gu;

export const withoutLinkChrome = (text: string): string => text.replaceAll(LINK_CHROME, (chrome) => " ".repeat(chrome.length));

const INLINE_CODE = /`[^`]*`/gu;

/** A heading with its code blanked out (`kubectl create configmap`): the body's prose masks code, a heading's text keeps it. */
export const withoutInlineCode = (sentence: Sentence): Sentence => ({
  ...sentence,
  text: sentence.text.replaceAll(INLINE_CODE, (code) => " ".repeat(code.length)),
});
