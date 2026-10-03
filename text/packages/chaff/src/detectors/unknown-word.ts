import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { isKnownWord, suggestionFor, wordsToCheck, type CheckedWord, type Speller } from "../spelling.ts";
import { quoteAt } from "./structure-tree.ts";

/** これより短い語は見ない。短い語は一字違いの語が多すぎて言い直しが決まらず（tost は test か toast か）、略した語（impl）も多い。 */
const MIN_LENGTH = 5;

/** これより長い字の並びは語でなく、符号化したデータ（base64、ハッシュ）。一字違いの形を作ると長さの二乗で重くなる。 */
const MAX_LENGTH = 30;

const patternsOf = (doc: ProseDocument, name: string): string[] => (doc.lexicons[name] ?? []).map((entry) => entry.pattern.toLowerCase());

/** 辞書と、語彙表 extra-word の語と、チームの names と、別の rule が言う誤り（known-misspelling）を足した語。 */
const spellerOf = (doc: ProseDocument, dictionary: ReadonlySet<string>): Speller => ({
  words: [dictionary, new Set([...patternsOf(doc, "extra-word"), ...(doc.names ?? []).map((name) => name.toLowerCase())])],
  suffixes: (doc.lexicons["word-suffix"] ?? []).map((entry) => ({ suffix: entry.pattern, replacement: entry.instead_of ?? "" })),
  prefixes: patternsOf(doc, "word-prefix"),
});

/** 文書で一度だけ使った語。二度以上使う語は、打ち間違いより、その文書の用語であることが多い。 */
const usedOnce = (words: readonly CheckedWord[]): CheckedWord[] => {
  const counts = new Map<string, number>();
  words.forEach(({ word }) => counts.set(word, (counts.get(word) ?? 0) + 1));
  return words.filter(({ word }) => counts.get(word) === 1);
};

/**
 * 辞書に無い英語の語で、一字違いの辞書の語があるもの（recieve → receive）。辞書は adapter が持ち、無い言語では動かない。
 * 大文字を含む語（固有名詞・略語）、コード・URL の中、二度以上使う語、言い直しの無い語は言わない。
 */
export const unknownWord: Detector = (doc): Finding[] => {
  if (doc.dictionary === undefined) return [];
  const speller = spellerOf(doc, doc.dictionary());
  const known = new Set(patternsOf(doc, "known-misspelling"));
  const words = wordsToCheck(doc.prose ?? doc.source, MIN_LENGTH, MAX_LENGTH);
  const used = new Set(words.map(({ word }) => word).filter((word) => isKnownWord(word, speller)));
  return usedOnce(words).flatMap(({ offset, word }) => {
    if (known.has(word) || isKnownWord(word, speller)) return [];
    const suggestion = suggestionFor(word, speller, used);
    if (suggestion === undefined) return [];
    return [{ rule: "", severity: "warning", line: 0, column: 0, quote: quoteAt(doc.source, offset), values: { word, suggestion, offset } }];
  });
};
