import type { Token } from "../plugin.ts";

/**
 * 宛名の並び（各国公私立高等専門学校長、公益財団法人日本博物館協会会長）の、名前の外の語。頭の「各」（語彙表 addressee-prefix）と、
 * 尻の役職（addressee-title: 長、会長、教育長）。endings は組織の名前を閉じる語（organisation-unit）、forms は法人格（organisation-form）。
 */
export type AddresseeWords = {
  readonly prefixes: readonly string[];
  readonly titles: readonly string[];
  readonly endings: readonly string[];
  readonly forms: readonly string[];
};

/** 組織の語の前に要る字数。1 字なら、普通の語の一部（本部、学校）と見分けられない。 */
const MIN_BODY_LENGTH = 2;

const charLength = (text: string): number => [...text].length;

/** 名前が組織の語（2 字以上の名の後ろの協会、学校）か法人格（独立行政法人）で閉じるか。 */
export const endsInOrganisation = (name: string, words: AddresseeWords): boolean =>
  words.forms.some((form) => name.endsWith(form)) ||
  words.endings.some((unit) => name.endsWith(unit) && charLength(name) - charLength(unit) >= MIN_BODY_LENGTH);

/** 尻の役職のうち、残りが組織の名前で閉じる最も長いもの（機構長 > 長）。役職だけの連なりや、組織で閉じないもの（延長、成長）は undefined。 */
export const trailingTitle = (run: string, words: AddresseeWords): string | undefined =>
  words.titles
    .filter((title) => run.length > title.length && run.endsWith(title) && endsInOrganisation(run.slice(0, run.length - title.length), words))
    .reduce<string | undefined>((longest, title) => (title.length > (longest?.length ?? 0) ? title : longest), undefined);

/**
 * 連なり（文書全体の座標で start から始まる）の頭の「各」の語。その語が連なりの頭にあり、残り（name: 役職を外した連なり）が
 * 組織の名前で閉じるときだけ。各国の「各」のような語の一部は、解析が別の語に分けたときしか外さない。
 */
export const leadingPrefix = (tokens: readonly Token[], start: number, name: string, words: AddresseeWords): Token | undefined => {
  const token = tokens.find((candidate) => candidate.span.start === start);
  if (token === undefined || !words.prefixes.includes(token.surface)) return undefined;
  const rest = name.slice(token.surface.length);
  return name.startsWith(token.surface) && rest !== "" && endsInOrganisation(rest, words) ? token : undefined;
};
