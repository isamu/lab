import type { Boundary } from "./orthography.ts";
import type { Span, Token } from "./plugin.ts";

// 英字の語の側で決まる、空け方の好みでない境目。pure: 語は語彙表から受け取る。

/** 英字の語を作る字。vs. の点も語の一部。 */
const LATIN_WORD_CHAR = /[A-Za-z.]/u;
const LATIN_WORD_AFTER = /^[A-Za-z.]+/u;
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u;

/** 境目の英字の側の語の範囲（「名前 or 任意」の or）。 */
const latinWordAt = (text: string, boundary: Boundary): Span => {
  if (LATIN_WORD_CHAR.test(text[boundary.offset - 1] ?? "")) {
    const reversed = Array.from(text.slice(0, boundary.offset)).toReversed().join("");
    return { start: boundary.offset - (LATIN_WORD_AFTER.exec(reversed)?.[0].length ?? 0), end: boundary.offset };
  }
  const start = boundary.offset + (boundary.spaced ? 1 : 0);
  return { start, end: start + (LATIN_WORD_AFTER.exec(text.slice(start))?.[0].length ?? 0) };
};

/** 語の前後が空白一つで、その外がどちらも日本語の字。 */
const standsBetweenJapanese = (text: string, word: Span): boolean =>
  text[word.start - 1] === " " && text[word.end] === " " && JAPANESE.test(text[word.start - 2] ?? "") && JAPANESE.test(text[word.end + 1] ?? "");

/**
 * 日本語の句と句をつなぐ英語の語（「名前 or メッセージ」「甲案 vs. 乙案」の or、vs.）の前後の空白。or を詰めて書くことは無く、
 * 語を区切る空白で、日本語と英字のあいだの空け方の票ではない。片側が英字の語（A or 任意、名前 or API）なら数える。
 * joiners は語彙表 latin-joiner の語（小文字）。
 */
export const isJoinerSpace = (text: string, boundary: Boundary, joiners: ReadonlySet<string>): boolean => {
  if (boundary.kind !== "letter" || !boundary.spaced) return false;
  const word = latinWordAt(text, boundary);
  return joiners.has(text.slice(word.start, word.end).toLowerCase()) && standsBetweenJapanese(text, word);
};

/**
 * 英字の語に付けて一つの語にする日本語の接尾の語（PDF版、IT化、Apple製）の前の境目。空けて書くことはほとんど無く、
 * 詰めたのは空け方の好みではない。語の頭の字が同じでも別の語（製品、型番）なら数える。suffixes は語彙表 latin-bound-suffix の語。
 * tokens は文書全体の座標で、base は text の先頭の位置。
 */
export const isBoundSuffix = (text: string, boundary: Boundary, tokens: readonly Token[] | undefined, base: number, suffixes: ReadonlySet<string>): boolean => {
  if (tokens === undefined || boundary.kind !== "letter" || !LATIN_WORD_CHAR.test(text[boundary.offset - 1] ?? "")) return false;
  const start = base + boundary.offset + (boundary.spaced ? 1 : 0);
  const suffix = tokens.find((token) => token.span.start === start);
  return suffix !== undefined && suffixes.has(suffix.surface);
};
