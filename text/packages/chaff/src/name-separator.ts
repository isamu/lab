import { isJapanese, type Boundary } from "./orthography.ts";
import type { Span, Token } from "./plugin.ts";

/** 名前を空白で並べた行（署名・連絡先・所属の行）に出る品詞。助詞・動詞・助動詞・連体詞が一つでもあれば、その行は文。 */
const NAME_LINE_POS = new Set(["NOUN", "PROPN", "NUM", "PUNCT", "SYM"]);

/** 文を閉じる字。これを含む行は名前の並びではなく文。 */
const SENTENCE_CLOSER = /[。．！？!?]/u;

const ALPHANUMERIC = /[A-Za-z0-9]/u;

/** at を含む行の範囲。 */
const lineAround = (text: string, at: number): Span => {
  const end = text.indexOf("\n", at);
  return { start: text.lastIndexOf("\n", at - 1) + 1, end: end === -1 ? text.length : end };
};

/** from から step の向きに英数字の並びを越えた先の字が日本語か（IR担当、株式会社ABC）。「言語：pt-BR」のように記号を挟めば、続けて書いた語ではない。 */
const gluedToJapanese = (text: string, from: number, step: 1 | -1): boolean => {
  const beyond = (at: number): number => (ALPHANUMERIC.test(text[at] ?? "") ? beyond(at + step) : at);
  return isJapanese(text[beyond(from)]);
};

/** 行の語がどれも名前の語で、文を閉じる字が無い。品詞の無い行は名前の並びと読まない。 */
const isNameLine = (lineTokens: readonly Token[]): boolean =>
  lineTokens.length > 0 && lineTokens.every((token) => NAME_LINE_POS.has(token.pos) && !SENTENCE_CLOSER.test(token.surface));

/**
 * 「株式会社あおば電子 経営企画部 IR担当」「東京本社 PR室」のように、名前だけを空白で並べた行で、英字の語が反対側では日本語に詰めて書かれている（IR担当）ときの空白。
 * 書き手は英字と日本語を詰めて書いているので、この空白は名前と名前の区切りで、英字の前後の空け方ではない。
 * 文の中の空白（この IT システムは）や、英字だけの語の前後（Patch リリース）は区切りと読まない。
 * boundary は空けた英字の境目（text[offset] が空白）。tokens は文書全体の座標で、base は text の先頭の位置。
 */
export const isNameSeparator = (text: string, boundary: Boundary, tokens: readonly Token[] | undefined, base: number): boolean => {
  if (tokens === undefined || boundary.kind !== "letter" || !boundary.spaced) return false;
  const latinAfter = ALPHANUMERIC.test(text[boundary.offset + 1] ?? "");
  if (!gluedToJapanese(text, latinAfter ? boundary.offset + 1 : boundary.offset - 1, latinAfter ? 1 : -1)) return false;
  const line = lineAround(text, boundary.offset);
  return isNameLine(tokens.filter((token) => token.span.start >= base + line.start && token.span.end <= base + line.end && token.surface.trim() !== ""));
};
