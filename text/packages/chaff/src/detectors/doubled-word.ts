import type { Detector, Finding, Lexicon, Sentence, Token } from "../plugin.ts";
import { citedNamesOf, endsCitedName } from "./cited-name.ts";

/**
 * 語を書き損じて二度書いた（the the / 資料をを）。消し忘れと、書き換えの途中で残った語（our the platform）の二つ。
 *
 * 同じ語は、表層（大文字小文字は問わない）と品詞の両方が同じときだけ。「that that」は接続詞と指示語で品詞が違う。
 * 冠詞と所有の語は名詞の前に一つしか立たないので、違う語でも二つ並べば書き損じ。印はアダプタが UD の FEATS で付ける。
 * どの言語でも書き損じでない重なり（had had / 一つ一つ）は、言語ごとの語彙表に置く。
 */

/**
 * 重ねても書き損じにならない品詞。記号と数は語ではない。間投詞（はいはい / no no）と副詞（そうそう / very very）は
 * 重ねて強める書き方がどの語でもできるので、語彙表では尽くせない。固有名詞は重なった名前（Walla Walla）がある。
 */
const REPEATABLE = new Set(["PUNCT", "SYM", "NUM", "X", "INTJ", "ADV", "PROPN"]);

/** 強調やリンクの印を挟んで重なった内容語は、画面名とその名詞（**app settings** settings screen）。機能語だけが書き損じ。 */
const FUNCTION_WORD = new Set(["DET", "ADP", "PRON", "AUX", "CCONJ", "SCONJ", "PART"]);

const LETTER = /\p{L}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const SPACE_ONLY = /^\s*$/u;
/** 語を空白で区切る言語で、語に接していれば長い語の一部（114A The の A、Content-Type の Content）。 */
const JOINED = /[\p{L}\p{N}-]/u;

const isWord = (token: Token): boolean => LETTER.test(token.surface) && !REPEATABLE.has(token.pos) && token.features?.["NumType"] !== "Card";

const isDeterminer = (token: Token): boolean => token.features?.["PronType"] === "Art" || token.features?.["Poss"] === "Yes";

const sameWord = (first: Token, second: Token): boolean => first.surface.toLowerCase() === second.surface.toLowerCase() && first.pos === second.pos;

/** 二語のあいだ。space は空白だけ、markup は印だけ（文字も数字も無い）、text はそれ以外で、別々の語。 */
export type Gap = "space" | "markup" | "text";

export const gapBetween = (source: string, first: Token, second: Token): Gap => {
  const between = source.slice(first.span.end, second.span.start);
  if (SPACE_ONLY.test(between)) return "space";
  return LETTER_OR_DIGIT.test(between) ? "text" : "markup";
};

/** 語を空白で区切る言語だけ。日本語は語どうしが接しているのが普通。 */
export const isPartOfLongerWord = (source: string, first: Token, second: Token): boolean =>
  JOINED.test(source.charAt(first.span.start - 1)) || JOINED.test(source.charAt(second.span.end));

const surfacesOf = (tokens: readonly Token[]): string => tokens.map((token) => token.surface.toLowerCase()).join("\u0000");

/**
 * 語彙表の行（had had、sign in in、set up up to）の k 語目と k+1 語目を重なりに重ねて、行の語が全部並んでいるか。
 * 一語の行は重なりを言っていないので、重ねる位置が無い。
 */
const coversPairAt = (tokens: readonly Token[], at: number, words: readonly Token[]): boolean =>
  Array.from({ length: words.length - 1 }, (_, k) => tokens.slice(at - k, at - k + words.length)).some((row) => surfacesOf(row) === surfacesOf(words));

/**
 * tokens の at 語目と次の語の重なりを、語彙表のどれかの行がそのまま含むか。
 * 語彙表の語は、文と同じ解析器で分けたもの（entry.tokens）で比べる。書き方の空白の有無に左右されない。
 */
export const isAllowed = (tokens: readonly Token[], at: number, allowed: Lexicon): boolean =>
  allowed.some((entry) => coversPairAt(tokens, at, entry.tokens ?? []));

export type Doubled = { readonly first: Token; readonly second: Token };

const LOWER_START = /^\p{Ll}/u;
const UPPER_START = /^\p{Lu}/u;

/** 小文字の語の後ろの大文字は、題名や名前の書き出し（the [Your Rights section]）。同じ語の the The は書き損じのまま。 */
export const startsTitle = (first: Token, second: Token): boolean => LOWER_START.test(first.surface) && UPPER_START.test(second.surface);

/** アダプタが重ね言葉（UD の Echo=Rdp）と読んだ語。「会社会社で」の二つ目。 */
const isEcho = (token: Token): boolean => token.features?.["Echo"] === "Rdp";

const isDeterminerPair = (first: Token, second: Token): boolean => isDeterminer(first) && isDeterminer(second) && !startsTitle(first, second);

const isDoubled = (first: Token, second: Token): boolean =>
  isWord(first) && isWord(second) && !isEcho(second) && (sameWord(first, second) || isDeterminerPair(first, second));

/** 並んだ二語が書き損じか。source は文書全体で、token の span もその座標。 */
export const doubledAt = (source: string, first: Token, second: Token, spaced: boolean): boolean => {
  if (!isDoubled(first, second)) return false;
  if (spaced && isPartOfLongerWord(source, first, second)) return false;
  const gap = gapBetween(source, first, second);
  return gap === "space" || (gap === "markup" && FUNCTION_WORD.has(first.pos));
};

/**
 * 文の途中で、大文字の語の後ろに小文字の同じ語が来たら、一つ目は名前（Payment for May may be delayed）。
 * 文頭の The the と、冠詞・所有の語（review The the draft）は名前にならないので書き損じ。
 */
export const isNameBefore = (first: Token, second: Token, opensSentence: boolean): boolean =>
  !opensSentence && !isDeterminer(first) && UPPER_START.test(first.surface) && LOWER_START.test(second.surface);

/** 文の最初の、字のある語の位置。at 語目より前に字のある語が無ければ、at 語目は文の書き出し。 */
const firstWordIndex = (tokens: readonly Token[]): number => tokens.findIndex((token) => LETTER.test(token.surface));

const repeatsPrevious = (tokens: readonly Token[], at: number): boolean => {
  const [previous, token] = [tokens[at - 1], tokens[at]];
  return previous !== undefined && token !== undefined && surfacesOf([previous]) === surfacesOf([token]);
};

/** 語彙表の重なり（had had）も、三つ続けば（had had had）書き損じ。 */
const allowedAt = (tokens: readonly Token[], at: number, allowed: Lexicon): Lexicon => (repeatsPrevious(tokens, at) ? [] : allowed);

/**
 * tokens の at 語目から、語彙表の決まった句（a priori・a la carte）が始まるか。句の頭の a は冠詞ではなく句の一部なので、
 * 前の違う冠詞と並んでも（the a priori approach）書き損じではない。同じ語（a a priori）は書き損じのまま。
 */
export const opensPhrase = (tokens: readonly Token[], at: number, phrases: Lexicon): boolean =>
  phrases.some((entry) => {
    const words = entry.tokens ?? [];
    return words.length > 1 && surfacesOf(tokens.slice(at, at + words.length)) === surfacesOf(words);
  });

export const doubledIn = (source: string, tokens: readonly Token[], spaced: boolean, allowed: Lexicon, phrases: Lexicon = []): Doubled[] => {
  const firstWord = firstWordIndex(tokens);
  return tokens.flatMap((second, index) => {
    const first = tokens[index - 1];
    if (first === undefined || !doubledAt(source, first, second, spaced)) return [];
    if (isAllowed(tokens, index - 1, allowedAt(tokens, index - 1, allowed))) return [];
    if (!sameWord(first, second) && opensPhrase(tokens, index, phrases)) return [];
    // first は字のある語なので、firstWord は見つかっていて index - 1 以下。
    const opensSentence = firstWord >= index - 1;
    return isNameBefore(first, second, opensSentence) ? [] : [{ first, second }];
  });
};

/** 印を挟んでいても（the [the）、見せるのは二語だけ。 */
const wordOf = (doubled: Doubled, spaced: boolean): string => [doubled.first.surface, doubled.second.surface].join(spaced ? " " : "");

const findingOf = (sentence: Sentence, doubled: Doubled, spaced: boolean): Finding => ({
  rule: "doubled-word",
  severity: "warning",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  values: { word: wordOf(doubled, spaced), offset: doubled.second.span.start },
});

/** 文書の種類の語（法・規則・契約書）。語彙表はアダプタが持つ。 */
const DOCUMENT_KIND = "document-kind";

/** 冠詞のような語で始まる決まった句。語彙表はアダプタが持つ。冠詞の無い言語（日本語）は持たない。 */
const FIXED_PHRASE = "fixed-phrase";

export const doubledWord: Detector = (doc, options): Finding[] => {
  const spaced = doc.lengthUnit === "word";
  const allowed = options.lexicon ?? [];
  const cited = citedNamesOf(doc.structure);
  const kinds = new Set((doc.lexicons[DOCUMENT_KIND] ?? []).map((entry) => entry.pattern));
  const phrases = doc.lexicons[FIXED_PHRASE] ?? [];
  return doc.sentences.flatMap((sentence) =>
    doubledIn(doc.source, sentence.tokens ?? [], spaced, allowed, phrases)
      .filter((doubled) => !endsCitedName(doubled.first, doubled.second, cited, kinds))
      .map((doubled) => findingOf(sentence, doubled, spaced)),
  );
};
