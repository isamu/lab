import type { BodyText } from "./definition-use.ts";

/**
 * 定義した語の頭の語（本・本件）を、同じ組のほかの語に替えた形。「本業務」と定義して「本件業務」と書くと、
 * 読み手は別のものを指しているのかと迷う。組は言語パッケージの語彙表（defined-term-prefix）の group から取る。
 */
export type PrefixGroups = readonly (readonly string[])[];

/** 語の前後の一字がこれなら、語は長い語の一部（見本物品の「本物品」、本業務委託契約の「本業務」）。 */
const WORD_CHAR = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}\p{N}ー]/u;

/** 頭の語のあとがこれより短い語（本件人、本件日）を替えると、普通の語（本人、本日）になる。 */
const MIN_REST = 2;

/** 語彙表の項目を group ごとにまとめる。group の無い項目と、一つしかない組は外す。 */
export const prefixGroupsOf = (entries: readonly { readonly pattern: string; readonly group?: string | undefined }[]): string[][] => {
  const groups = new Map<string, string[]>();
  entries.forEach((entry) => {
    if (entry.group === undefined || entry.pattern === "") return;
    groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry.pattern]);
  });
  return [...groups.values()].filter((group) => group.length > 1);
};

/** 語の頭の語を同じ組のほかの語に替えた形。頭の語は長いほうから当て、頭の語のあとが一字の語には形が無い。 */
export const prefixVariants = (term: string, groups: PrefixGroups): string[] =>
  groups.flatMap((group) => {
    const prefix = group
      .filter((candidate) => term.startsWith(candidate) && term.length > candidate.length)
      .toSorted((left, right) => right.length - left.length)[0];
    const rest = prefix === undefined ? "" : term.slice(prefix.length);
    if (prefix === undefined || [...rest].length < MIN_REST) return [];
    return group.filter((other) => other !== prefix).map((other) => `${other}${rest}`);
  });

/**
 * 定義の後ろ（after より後）で、形の違う語を書いた位置。長い語の一部と、定義した語の始まり（本件物品明細と定義した所の本件物品）は除く。
 */
export const variantUses = (source: string, texts: readonly BodyText[], variant: string, after: number, defined: readonly string[]): number[] =>
  texts.flatMap((text) => {
    const offsets: number[] = [];
    let at = text.text.indexOf(variant);
    while (at !== -1) {
      offsets.push(text.start + at);
      at = text.text.indexOf(variant, at + variant.length);
    }
    return offsets.filter(
      (offset) =>
        offset > after &&
        !WORD_CHAR.test(source.charAt(offset - 1)) &&
        !WORD_CHAR.test(source.charAt(offset + variant.length)) &&
        !defined.some((term) => source.startsWith(term, offset)),
    );
  });
