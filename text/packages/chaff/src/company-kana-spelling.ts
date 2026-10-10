import type { CompanyMention } from "./company-names.ts";
import { toKatakana } from "./kana-spelling.ts";
import { escapeRegExp } from "./orthography.ts";

// 会社の名前の漢字一字を、その読みのかなで書いた所（みどり野生命保険株式会社 と みどりの生命保険株式会社）。読みは品詞解析が言う。

/** 名前の中の語。start と end は source の上の位置。reading はカタカナ。 */
export type ReadWord = { readonly start: number; readonly end: number; readonly surface: string; readonly reading: string | undefined };

/** 漢字の名前を、かなで書いた所。usual は多いほうの書き方。 */
export type KanaSpelled = { readonly surface: string; readonly offset: number; readonly usual: string };

const HAN = /^\p{Script=Han}$/u;
const KANA = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]$/u;
const KATAKANA = /[ァ-ヶ]/gu;
const KATAKANA_TO_HIRAGANA = 0x60;
/** かなで書いた所の外側に続くと、名前の続き（別の名前）になる字。 */
const NAME_CHAR = /[\p{Script=Katakana}\p{Script=Han}\p{Script=Latin}\p{N}ー]/u;
/** 多いほうの書き方の数。一度だけの名前は、どちらが正しいとも言えない。 */
const MIN_USUAL_COUNT = 2;

const toHiragana = (text: string): string => text.replace(KATAKANA, (char) => String.fromCodePoint((char.codePointAt(0) ?? 0) - KATAKANA_TO_HIRAGANA));

/**
 * かなと漢字一字の語（みどり野 ミドリノ、野 ノ）の、漢字の読みと、語の中の位置（UTF-16 の単位）。かなの部分が読みの頭と終わりに
 * 合い、残りがあるときだけ。漢字二字以上の語（生命 セイメイ）は、どの字がどの音か分からないので読まない。
 */
export const kanjiReadingOf = (
  surface: string,
  reading: string | undefined,
): { readonly index: number; readonly kanji: string; readonly reading: string } | undefined => {
  const chars = [...surface];
  const at = chars.findIndex((char) => HAN.test(char));
  const kanji = chars[at];
  if (reading === undefined || kanji === undefined || !chars.every((char, index) => index === at || KANA.test(char))) return undefined;
  const [head, tail] = [toKatakana(chars.slice(0, at).join("")), toKatakana(chars.slice(at + 1).join(""))];
  const read = toKatakana(reading);
  if (read.length <= head.length + tail.length || !read.startsWith(head) || !read.endsWith(tail)) return undefined;
  return { index: chars.slice(0, at).join("").length, kanji, reading: read.slice(head.length, read.length - tail.length) };
};

const baseStartOf = (mention: CompanyMention): number =>
  mention.position === "after" ? mention.offset : mention.offset + mention.surface.length - mention.base.length;

/** 会社の名前の、漢字一字をその読みのひらがなかカタカナで書いた形（みどりの生命保険株式会社、みどりノ生命保険株式会社）。 */
export const kanaSpellingsOf = (mention: CompanyMention, words: readonly ReadWord[]): string[] => {
  const baseStart = baseStartOf(mention);
  const baseEnd = baseStart + mention.base.length;
  return words
    .filter((word) => word.start >= baseStart && word.end <= baseEnd)
    .flatMap((word) => {
      const read = kanjiReadingOf(word.surface, word.reading);
      if (read === undefined) return [];
      const at = word.start - mention.offset + read.index;
      const [before, after] = [mention.surface.slice(0, at), mention.surface.slice(at + read.kanji.length)];
      return [toHiragana(read.reading), read.reading].map((kana) => `${before}${kana}${after}`);
    });
};

const HIRAGANA = /^\p{Script=Hiragana}$/u;
const HIRAGANA_AFTER = /^\p{Script=Hiragana}+/u;
/** 助詞を探す、前のひらがなの字数。語彙表の一番長い助詞より長い。 */
const PARTICLE_LOOKBACK = 10;

const hiraganaBefore = (source: string, at: number): string => {
  const chars = Array.from(source.slice(Math.max(0, at - PARTICLE_LOOKBACK), at));
  return chars.slice(chars.findLastIndex((char) => !HIRAGANA.test(char)) + 1).join("");
};

/**
 * 名前の側に名前の字が続かない現れ。続けば、別の長い名前の一部（あおいみどりの生命保険）。ひらがなが続くときは、助詞（当社は、
 * と、における）で切れるときだけ名前の外と見る。particles は語彙表 company-name-kana の particle。
 */
const standsAlone = (source: string, at: number, length: number, position: CompanyMention["position"], particles: readonly string[]): boolean => {
  const neighbour = position === "after" ? source.charAt(at - 1) : source.charAt(at + length);
  if (NAME_CHAR.test(neighbour)) return false;
  const kana = position === "after" ? hiraganaBefore(source, at) : (HIRAGANA_AFTER.exec(source.slice(at + length))?.[0] ?? "");
  if (kana === "") return true;
  return particles.some((particle) => (position === "after" ? kana.endsWith(particle) : kana.startsWith(particle)));
};

const occurrencesOf = (source: string, text: string): number[] => [...source.matchAll(new RegExp(escapeRegExp(text), "gu"))].map((match) => match.index);

/**
 * 二度以上書いた会社の名前の漢字一字を、その読みのかなで書いた所が一度だけある所。名前のほかの所はそのまま同じもの。
 * 語の読みは words が言う（品詞解析の語）。前後のひらがなを切る助詞は particles。
 */
export const kanaSpelledCompanies = (
  source: string,
  mentions: readonly CompanyMention[],
  words: readonly ReadWord[],
  particles: readonly string[],
): KanaSpelled[] => {
  const counts = new Map<string, number>();
  mentions.forEach((mention) => counts.set(mention.surface, (counts.get(mention.surface) ?? 0) + 1));
  const usuals = mentions.filter(
    (mention, index) => (counts.get(mention.surface) ?? 0) >= MIN_USUAL_COUNT && mentions.findIndex((other) => other.surface === mention.surface) === index,
  );
  return usuals.flatMap((usual) =>
    [...new Set(kanaSpellingsOf(usual, words))].flatMap((spelled) => {
      const found = occurrencesOf(source, spelled).filter((at) => standsAlone(source, at, spelled.length, usual.position, particles));
      return found.length === 1 && found[0] !== undefined ? [{ surface: spelled, offset: found[0], usual: usual.surface }] : [];
    }),
  );
};
