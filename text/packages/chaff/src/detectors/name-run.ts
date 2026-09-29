import type { Token } from "../plugin.ts";

const nameType = (token: Token | undefined): string | undefined => token?.features?.["NameType"];

/** 人の姓と名（田中太郎）。姓が 2 つ続けば（田中山田）、名前の並び。 */
const isFullName = (named: readonly (Token | undefined)[]): boolean => named.length === 2 && nameType(named[0]) === "Sur" && nameType(named[1]) === "Giv";

/**
 * 漢字の連なりの語（covering: tokens の添字）が 1 つの名前か。辞書が固有名詞と読む 1 語（日本銀行）か、人の姓と名。
 * 名前は書き手が変えられない。固有名詞に普通の語が続けば（武蔵野美術大学造形構想学部、東京都知事選挙管理委員会事務局）、
 * 名前から組み立てた語で、どこで切れるかは読み手に見えない。名前が続けば（日本銀行日本電信電話）、並び。どちらも名前とは言わない。
 */
export const isOneName = (tokens: readonly Token[], covering: readonly number[]): boolean => {
  const named = covering.map((index) => tokens[index]);
  return (named.length === 1 && named[0]?.pos === "PROPN") || isFullName(named);
};
