import type { Token } from "../plugin.ts";

/** 地名（Geo）と、地名に付く単位（GeoUnit: 都・県・郡・市・区・町・村）。 */
const isGeoName = (token: Token | undefined): boolean => token?.features?.["NameType"] === "Geo";
const isGeoUnit = (token: Token | undefined): boolean => token?.features?.["NameType"] === "GeoUnit";
const isGeo = (token: Token | undefined): boolean => isGeoName(token) || isGeoUnit(token);
const isNumber = (token: Token | undefined): boolean => token?.features?.["NumType"] === "Card";

/**
 * 辞書に無い町名は、形態素解析が固有名詞か 1 字ずつに割る（紀美野町は 紀＋美野、南伊勢町は 南＋伊勢、久米島町は固有名詞,一般）。
 * 2 字以上の普通の語（政策・総務）は地名のかけらにしない。
 */
const isNamePiece = (token: Token | undefined): boolean => token !== undefined && (token.pos === "PROPN" || [...token.surface].length === 1);

/** 連なりの語と、閉じても 1 つの地名にならない単位（都道府県。住所の先頭にしか来ない。語彙表 prefecture-unit）。 */
type Run = { readonly tokens: readonly Token[]; readonly last: number; readonly topUnits: ReadonlySet<string> };

/**
 * index から地名のかけらだけを読み進めて、連なりの終わりまでに都道府県より下の単位（郡・市・町）で閉じるか。
 * 閉じれば、そこまでが 1 つの地名。連なりの外（「に」「の」も 1 字）までは読まない。
 */
const closedByUnit = (run: Run, index: number): boolean => {
  for (let at = index; at <= run.last; at += 1) {
    const token = run.tokens[at];
    if (token === undefined) return false;
    if (isGeoUnit(token)) return !run.topUnits.has(token.surface);
    if (!isNamePiece(token)) return false;
  }
  return false;
};

/**
 * 住所の語: 地名と地名の単位（NameType=Geo / GeoUnit）、数（NumType=Card）、数のすぐ後ろの助数詞（丁目、NounType=Class）。
 * 辞書に無い町名（新橋）は、地名の後ろで数の前に来るときだけ住所の一部とする。
 * 割られた町名（紀美野町）は、単位の後ろで、地名のかけらだけを挟んで次の単位で閉じるときだけ住所の一部とする。
 */
const isPlacePart = (run: Run, index: number): boolean => {
  const tokens = run.tokens;
  return (
    isGeo(tokens[index]) ||
    isNumber(tokens[index]) ||
    (isNumber(tokens[index - 1]) && tokens[index]?.features?.["NounType"] === "Class") ||
    (isGeo(tokens[index - 1]) && isNumber(tokens[index + 1])) ||
    (isGeo(tokens[index - 1]) && isNamePiece(tokens[index]) && closedByUnit(run, index + 1))
  );
};

/**
 * 地名が単位を挟まずに続けば地名の並び（東京大阪名古屋福岡）。ただし 2 つだけで郡・市・町が閉じれば、割られた 1 つの地名
 * （北海道虻田郡、富士河口湖町）。3 つ続けば、単位が付いても並び（京都奈良大阪神戸市）。
 * 名古屋大阪市は北海道札幌市と品詞が同じ形なので、ここでは分けられない。
 */
const isListed = (run: Run, index: number): boolean =>
  isGeoName(run.tokens[index]) && isGeoName(run.tokens[index + 1]) && (isGeoName(run.tokens[index + 2]) || !closedByUnit(run, index + 1));

/**
 * 漢字の連なりの語（covering: tokens の添字）が住所か（東京都港区新橋二丁目）。地名で始まり、住所の語だけでできている。
 * 住所は決まった形で、ひらがなを挟んで書けない。組織名（日本経済団体連合会）は地名の後ろに普通の語が続くので住所ではない。
 * topUnits は、住所の先頭にしか来ない単位（都道府県）。言語の語彙表から渡す。
 */
export const isAddressRun = (tokens: readonly Token[], covering: readonly number[], topUnits: ReadonlySet<string>): boolean => {
  const [first, last] = [covering[0], covering.at(-1)];
  if (first === undefined || last === undefined) return false;
  const run: Run = { tokens, last, topUnits };
  return isGeo(tokens[first]) && !covering.some((index) => isListed(run, index)) && covering.every((index) => isPlacePart(run, index));
};
