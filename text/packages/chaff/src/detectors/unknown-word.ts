import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { hasTwoEndings, isKnownWord, isSplitWord, suggestionFor, wordsToCheck, type Speller } from "../spelling.ts";
import { parse } from "../markdown-read.ts";
import { eachPreOrder } from "../tree-walk.ts";
import { quoteAt } from "./structure-tree.ts";
import { addressWordsOf, besideForeignWord, hasDrugStem, inSearchTermList, isClosedCompound, isMention, usedOnce } from "./unknown-word-context.ts";

/** これより短い語は見ない。短い語は一字違いの語が多すぎて言い直しが決まらず（tost は test か toast か）、略した語（impl）も多い。 */
const MIN_LENGTH = 5;

/** これより長い字の並びは語でなく、符号化したデータ（base64、ハッシュ）。一字違いの形を作ると長さの二乗で重くなる。 */
const MAX_LENGTH = 30;

const patternsOf = (doc: ProseDocument, name: string): string[] => (doc.lexicons[name] ?? []).map((entry) => entry.pattern.toLowerCase());

/** 辞書と、語彙表 extra-word の語と、チームの names と、別の rule が言う誤り（known-misspelling）を足した語。 */
export const spellerOf = (doc: ProseDocument, dictionary: ReadonlySet<string>): Speller => ({
  words: [dictionary, new Set([...patternsOf(doc, "extra-word"), ...(doc.names ?? []).map((name) => name.toLowerCase())])],
  suffixes: (doc.lexicons["word-suffix"] ?? []).map((entry) => ({
    suffix: entry.pattern,
    replacement: entry.instead_of ?? "",
    inflection: entry.group === "inflection",
  })),
  prefixes: patternsOf(doc, "word-prefix"),
  uninflected: new Set(patternsOf(doc, "uninflected-word")),
});

const LETTERS = /\p{L}+/gu;

/** 文書がコード（コードの区画と `…`）に書いた語。コードに書いた名前（`tidyq check` の tidyq）は、地の文でも打ち間違いではない。 */
export const codeWordsOf = (source: string): Set<string> => {
  const words = new Set<string>();
  eachPreOrder(parse(source), (node) => {
    if (node.type === "code" || node.type === "inlineCode")
      (node.value ?? "")
        .toLowerCase()
        .match(LETTERS)
        ?.forEach((word) => words.add(word));
  });
  return words;
};

/** 辞書の語か、派生した語に活用の語尾を付けた語（operationalises、rightsized）か、四字以上の辞書の語二つを続けた語（crowdwork）。 */
const isFormedWord = (word: string, speller: Speller): boolean => isKnownWord(word, speller) || hasTwoEndings(word, speller) || isClosedCompound(word, speller);

/** 置かれた場所から、名前や用語と分かる語。名指した語（"mailto"、(jchaplin)）、検索語の並び（vaccin*）、外国語の句（bête noire）。 */
const isTermByPlace = (source: string, offset: number, word: string): boolean =>
  isMention(source, offset, word) || inSearchTermList(source, offset) || besideForeignWord(source, offset, word);

/**
 * 辞書に無い英語の語で、一字違いの辞書の語があるもの（recieve → receive）。辞書は adapter が持ち、無い言語では動かない。
 * 大文字を含む語（固有名詞・略語）、コード・URL の中、頭の字を分けた語の残り、二度以上使う語、言い直しの無い語、
 * 文書がコードにも書いた語は言わない。
 */
export const unknownWord: Detector = (doc): Finding[] => {
  if (doc.dictionary === undefined) return [];
  const speller = spellerOf(doc, doc.dictionary());
  const known = new Set([...patternsOf(doc, "known-misspelling"), ...codeWordsOf(doc.source), ...addressWordsOf(doc.source)]);
  const drugStems = patternsOf(doc, "drug-stem");
  const words = wordsToCheck(doc.prose ?? doc.source, MIN_LENGTH, MAX_LENGTH).filter(({ offset }) => !isSplitWord(doc.source, offset));
  const used = new Set(words.map(({ word }) => word).filter((word) => isKnownWord(word, speller)));
  return usedOnce(words, speller).flatMap(({ offset, word }) => {
    if (known.has(word) || isFormedWord(word, speller) || hasDrugStem(word, drugStems) || isTermByPlace(doc.source, offset, word)) return [];
    const suggestion = suggestionFor(word, speller, used);
    if (suggestion === undefined) return [];
    return [{ rule: "", severity: "warning", line: 0, column: 0, quote: quoteAt(doc.source, offset), values: { word, suggestion, offset } }];
  });
};
