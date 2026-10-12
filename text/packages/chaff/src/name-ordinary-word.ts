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

/** 人を書く欄の行の頭の、Markdown の印（箇条書き、引用、見出し、太字）。 */
const LINE_MARKS = /^[\s>*#+-]*(?:\*\*|__)?/u;
/** 欄の後ろの名前: 大文字で始まる一語から三語（Ellen J. Marsh）。行の終わりか、「,」か括弧の前まで。 */
const FIELD_NAME = /^(?:\*\*|__)?[ \t]*(\p{Lu}[\p{L}'’.-]*(?:[ \t]+\p{Lu}[\p{L}'’.-]*){0,2})[ \t]*(?:[,(（].*)?$/u;

/** 行が人を書く欄（Customer: Ellen Marsh）なら、欄の後ろの名前の最後の語（姓）。欄の語は、行の頭の「:」の前の語まるごとで照らす。 */
const labelledSurname = (line: string, labels: ReadonlySet<string>): string | undefined => {
  const colon = line.search(/[:：]/u);
  if (colon < 0) return undefined;
  const label = line
    .slice(0, colon)
    .replace(LINE_MARKS, "")
    .replace(/(?:\*\*|__)$/u, "")
    .trim()
    .toLowerCase();
  if (!labels.has(label)) return undefined;
  return FIELD_NAME.exec(line.slice(colon + 1))?.[1]
    ?.split(/[ \t]+/u)
    .at(-1)
    ?.replace(/\.$/u, "");
};

/**
 * 文書が word を、人を書く欄の名前の最後の語（姓）に書くか（Customer: Ellen Marsh、Client: Marsh）。書けば、その語を人の名前に
 * 使っている。欄の後ろの最後の語だけを見るので、Name: Green Valley Farm の Green は名前に使った語にならない。
 */
const labelledSurnamesIn = (source: string, labels: readonly string[]): ReadonlySet<string> => {
  const wanted = new Set(labels.map((label) => label.toLowerCase()));
  return new Set(wanted.size === 0 ? [] : source.split(/\r?\n/u).flatMap((line) => labelledSurname(line, wanted) ?? []));
};

export const isLabelledIn = (source: string, labels: readonly string[], word: string): boolean => labelledSurnamesIn(source, labels).has(word);

/**
 * 一語の名前の現れのうち、その語がふつうの語でもあり（ordinaryStarts は、そういう語の頭の位置）、文書のどこでも敬称や肩書きの
 * 後ろにも、人を書く欄（labels）の姓にも書かないものに ordinary を付ける。同じ形の現れが一つでもそうでなければ、その形のどの現れにも付けない。
 */
export const withOrdinaryWords = (
  mentions: readonly NameMention[],
  ordinaryStarts: ReadonlySet<number>,
  source: string,
  titles: readonly string[],
  labels: readonly string[] = [],
): NameMention[] => {
  const isOrdinary = (mention: NameMention): boolean => {
    const [word] = mention.words;
    return mention.words.length === 1 && word !== undefined && ordinaryStarts.has(mention.offset);
  };
  const named = new Set(mentions.filter((mention) => !isOrdinary(mention)).map((mention) => mention.surface));
  const ordinarySurfaces = new Set(mentions.filter((mention) => !named.has(mention.surface) && isOrdinary(mention)).map((mention) => mention.surface));
  const labelled = labelledSurnamesIn(source, labels);
  const neverNamed = new Set([...ordinarySurfaces].filter((surface) => !isTitledIn(source, titles, surface) && !labelled.has(surface)));
  return mentions.map((mention) => (neverNamed.has(mention.surface) ? { ...mention, ordinary: true } : mention));
};
