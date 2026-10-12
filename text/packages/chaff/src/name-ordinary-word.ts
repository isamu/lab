import type { Token } from "./plugin.ts";
import type { NameMention } from "./name-variants.ts";
import { escapeRegExp } from "./orthography.ts";

// 名前と読んだ一語が、ふつうの語でもある所（文頭や題の Green、国の名の Greek）。二つのふつうの語（Green と Greek、Course と
// Curse）は一字違いでも別の語で、同じ名前の書き損じではない。

/** 解析器が名前と読んだ語が、小文字で書けばふつうの語か（adapter の OrdinaryWord=Yes）。 */
export const isOrdinaryToken = (token: Token): boolean => token.features?.["OrdinaryWord"] === "Yes";

/** 文書が word を敬称か肩書きの後ろに書くか（Mr. Green、Senator Marsh）。書けば、その語を人の名前に使っている。 */
export const isTitledIn = (source: string, titles: readonly string[], word: string): boolean =>
  titles.some((title) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(title)}\\s+${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, "u").test(source));

/**
 * 一語の名前の現れのうち、その語がふつうの語でもあり（ordinaryStarts は、そういう語の頭の位置）、文書のどこでも敬称や肩書きの
 * 後ろに書かないものに ordinary を付ける。
 */
export const withOrdinaryWords = (
  mentions: readonly NameMention[],
  ordinaryStarts: ReadonlySet<number>,
  source: string,
  titles: readonly string[],
): NameMention[] => {
  const titled = new Map<string, boolean>();
  const isTitled = (word: string): boolean => titled.get(word) ?? titled.set(word, isTitledIn(source, titles, word)).get(word) === true;
  return mentions.map((mention) => {
    const [word] = mention.words;
    const ordinary = mention.words.length === 1 && word !== undefined && ordinaryStarts.has(mention.offset) && !isTitled(word);
    return ordinary ? { ...mention, ordinary } : mention;
  });
};
