import type { Span, Token } from "./plugin.ts";

/** 空白の前の、建物や場所の名前になる語の品詞。助詞の後ろ（「会場は 5階」）は名前の区切りではない。 */
const NAME_POS = new Set(["NOUN", "PROPN"]);

/** 階・部屋の番号の後ろに続けば、番号が語の一部（5階建て、5階です）で、所在の組を閉じていない字。 */
const WORD_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

const SPACES = new Set([" ", "　"]);

/** units は階・部屋の番号の単位（語彙表 floor-unit）、levels は番号の前に書いて階の名前の一部になる語（語彙表 floor-level）。 */
export type FloorWords = { readonly units: ReadonlySet<string>; readonly levels: ReadonlySet<string> };

/** run のすぐ後ろに書いた、units のうち最も長い語。無ければ undefined。 */
const unitAfter = (text: string, run: Span, units: ReadonlySet<string>): string | undefined =>
  [...units].filter((unit) => text.startsWith(unit, run.end)).toSorted((left, right) => right.length - left.length)[0];

/**
 * 「本社 5階 第2会議室」「研究所 3階 セミナー室」のように、名前の語の後ろに空白で区切って書いた階・部屋の番号。
 * その前の空白は所在の組を分ける区切りで、日本語と数字のあいだの空け方の好みではない。「地下 1階」「地上 5階」の空白は階の名前の中の空け方なので、区切りと読まない。
 * 番号は数字だけで、単位の後ろで組が閉じる（空白・読点・文末・英字が続く）ものだけ。tokens は文書全体の座標で、base は text の先頭の位置。
 */
export const isSpacedLocationPart = (text: string, run: Span, tokens: readonly Token[] | undefined, base: number, words: FloorWords): boolean => {
  if (tokens === undefined || !SPACES.has(text[run.start - 1] ?? "")) return false;
  if (!/^\d+$/u.test(text.slice(run.start, run.end))) return false;
  const unit = unitAfter(text, run, words.units);
  if (unit === undefined || WORD_CHAR.test(text[run.end + unit.length] ?? "")) return false;
  const named = tokens.find((token) => token.span.end === base + run.start - 1);
  return named !== undefined && NAME_POS.has(named.pos) && !words.levels.has(named.surface);
};
