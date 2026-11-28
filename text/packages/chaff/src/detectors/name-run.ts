import type { Token } from "../plugin.ts";

const nameType = (token: Token | undefined): string | undefined => token?.features?.["NameType"];

/** 人の姓と名（田中太郎）。姓が 2 つ続けば（田中山田）、名前の並び。 */
export const isFullName = (named: readonly (Token | undefined)[]): boolean =>
  named.length === 2 && nameType(named[0]) === "Sur" && nameType(named[1]) === "Giv";

/**
 * 漢字の連なりの語（covering: tokens の添字）が 1 つの名前か。辞書が固有名詞と読む 1 語（日本銀行）か、人の姓と名。
 * 名前は書き手が変えられない。固有名詞に普通の語が続けば（武蔵野美術大学造形構想学部、東京都知事選挙管理委員会事務局）、
 * 名前から組み立てた語で、どこで切れるかは読み手に見えない。名前が続けば（日本銀行日本電信電話）、並び。どちらも名前とは言わない。
 */
export const isOneName = (tokens: readonly Token[], covering: readonly number[]): boolean => {
  const named = covering.map((index) => tokens[index]);
  return (named.length === 1 && named[0]?.pos === "PROPN") || isFullName(named);
};

/** 固有名詞と読む最短の字数。1 字の固有名詞は、解析が普通の語のかけらをそう読んだものと見分けられない。 */
const MIN_PROPER_LENGTH = 2;

const lengthOf = (token: Token): number => [...token.surface].length;
const isProperWord = (token: Token): boolean => token.pos === "PROPN" && lengthOf(token) >= MIN_PROPER_LENGTH;

/** 名前でも地名の単位（県・市）でもない語。名前だけを並べた連なり（東京大阪名古屋福岡、田中一郎山田花子）は並びで、1 つの名前ではない。 */
const isOrdinaryWord = (token: Token): boolean => token.pos !== "PROPN" && token.features?.["NameType"] !== "GeoUnit";

/** サ変の名詞（決議、違反、改革）。名前の後ろに付けば、名前についての出来事を言う句で、名前の一部ではない（国連安保理決議違反）。 */
const isVerbalNoun = (token: Token): boolean => token.features?.["VerbForm"] === "Vnoun";

/**
 * 漢字の連なりの語（covering）の字の半分以上が固有名詞（地名・組織名・人名）か。そうなら、名前を並べて組み立てた 1 つの名前
 * （東北地方太平洋沖地震は 東北＋地方＋太平洋＋沖＋地震、阪神淡路大震災）。読み手は名前を 1 語ずつ知っているので、切れ目を探さない。普通の語を含まない連なりは名前の並び。サ変の名詞を含む連なりは、名前についての句。
 * 名前に長い普通の語が続く連なり（日本弁護士連合会臨時総会決議）は、普通の語の方が長いので名前とは言わない。
 */
export const isMostlyNames = (tokens: readonly Token[], covering: readonly number[]): boolean => {
  const named = covering.flatMap((index) => tokens.slice(index, index + 1));
  const proper = named.filter(isProperWord).reduce((sum, token) => sum + lengthOf(token), 0);
  const total = named.reduce((sum, token) => sum + lengthOf(token), 0);
  return proper > 0 && proper * 2 >= total && named.some(isOrdinaryWord) && !named.some(isVerbalNoun);
};

/** 連なりの語（covering）が 1 つの名前か: 辞書の固有名詞 1 語か人の姓と名（isOneName）か、名前を並べて組み立てた名前（isMostlyNames）。 */
export const isNamed = (tokens: readonly Token[], covering: readonly number[]): boolean => isOneName(tokens, covering) || isMostlyNames(tokens, covering);
