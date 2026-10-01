import type { Lexicon } from "../plugin.ts";

type Span = { readonly start: number; readonly end: number };

/** 雛形の空欄を囲む括弧。記号の形で、どの言語でも同じ。 */
const BRACKETED = /\[([^[\]\n]{1,60})\]|【([^【】\n]{1,30})】|［([^［］\n]{1,30})］/gu;

/**
 * 括弧のすぐ後ろ。Markdown のリンク（[text](url)、[text][ref]）と参照の定義（[ref]: url）、
 * 値が続く見出しの札（【氏名】山田、【日付】2024年）は空欄ではない。助詞（【会社名】の）や空白・句読点が続くなら空欄。
 */
const FILLED_AFTER = /^[([:：\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}\p{N}]/u;

const innerOf = (match: RegExpExecArray): string => (match[1] ?? match[2] ?? match[3] ?? "").trim().toLowerCase();

/** 括弧の中身が語彙表の語そのものか、その語で始まって空白・アポストロフィが続くか（[Your Name]、[Insert Date]）。 */
const holdsWord = (inner: string, words: Lexicon): boolean =>
  words.some((word) => {
    const pattern = word.pattern.toLowerCase();
    return inner === pattern || (inner.startsWith(pattern) && /^[\s'’]/u.test(inner.slice(pattern.length)));
  });

/** 文の中の、埋め忘れた雛形の空欄（[Your Name]、【会社名】）の範囲。words は空欄に書く語。 */
export const placeholderSpans = (text: string, words: Lexicon): Span[] =>
  [...text.matchAll(BRACKETED)]
    .filter((match) => !FILLED_AFTER.test(text.slice(match.index + match[0].length)) && holdsWord(innerOf(match), words))
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
