// How a list item's last words are found: past the marks after them (!!, a footnote reference [^1]), which the tagger
// may call nouns. Pure; reads tokens only.
import type { Token } from "../plugin.ts";

/** Only marks (!!, ?!, …), whatever tag the tagger gave them. */
const MARKS_ONLY = /^[\p{P}\s]+$/u;

/** The caret that opens a footnote reference: alone after its masked bracket, or with the bracket when no definition masks it ([^). */
const CARET = /^\[?\^$/u;

/** The blank a masked bracket leaves before the caret. */
const BLANK = /^\s+$/u;

/** A footnote label after the caret: [^1], [^note-2]. */
const FOOTNOTE_LABEL = /^[\p{L}\p{N}_-]+$/u;

/** A token that ends an item's look but is not one of its words. */
export type IsMark = (token: Token) => boolean;

/** A tag-skipped token, or one made only of marks. */
export const markOrSkipped =
  (skipped: ReadonlySet<string>): IsMark =>
  (token) =>
    skipped.has(token.pos) || MARKS_ONLY.test(token.surface);

/**
 * The tokens before a footnote reference at the end (…まだ先 [^1]). The caret must carry its bracket or follow the blank
 * its masked bracket leaves, so x^2 and "x: ^2" keep their exponent.
 */
export const withoutFootnoteReference = (tokens: readonly Token[], isMark: IsMark): readonly Token[] => {
  const caret = tokens.findLastIndex((token) => CARET.test(token.surface));
  const opener = tokens[caret];
  const before = tokens[caret - 1];
  if (opener === undefined || !(opener.surface.startsWith("[") || (before !== undefined && BLANK.test(before.surface)))) return tokens;
  const label = tokens.slice(caret + 1);
  return label.every((token) => isMark(token) || FOOTNOTE_LABEL.test(token.surface)) ? tokens.slice(0, caret) : tokens;
};

/** The tokens up to the last word: the marks after it dropped. */
export const withoutTrailingMarks = (tokens: readonly Token[], isMark: IsMark): readonly Token[] =>
  tokens.slice(0, tokens.findLastIndex((token) => !isMark(token)) + 1);

/**
 * A noun with あり or なし right after it (翻訳あり, 駐車場なし): a headline's "with" or "without", not a predicate. A
 * particle between them (翻訳があり) makes it a clause. `endings` holds the words, from the word list headline-ending.
 */
export const endsAsHeadline = (words: readonly Token[], endings: ReadonlySet<string>): boolean => {
  const last = words.at(-1);
  const before = words.at(-2);
  return last !== undefined && endings.has(last.surface) && (before?.pos === "NOUN" || before?.pos === "PROPN");
};
