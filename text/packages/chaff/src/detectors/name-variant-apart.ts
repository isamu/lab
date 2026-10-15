import type { ProseDocument, Token } from "../plugin.ts";
import { nameKey, type NameMention } from "../name-variants.ts";
import { companyGroupBases, type CompanyMention } from "../company-names.ts";
import type { OrderName } from "../name-word-order.ts";
import { isInCapitalsPassage } from "../capitals-passage.ts";
import { givenNameBefore } from "../name-given-before.ts";
import { definedTerms } from "../structure/definition-use.ts";

// name-variant が、似た形でも別のものと見る所。大文字で書いた一節、名の違う二人、会社のグループの一社ずつ、定義した語、同じ文に
// 並べた二つ。

/** 大文字で書いた一節（契約書の免責の段落、大文字の見出し）の中の名前（eGAIN SYSTEM）。その節の大文字で、名前の書き方ではない。 */
export const outsideCapitals = <Mention extends { readonly offset: number; readonly surface: string }>(
  prose: string,
  mentions: readonly Mention[],
): Mention[] => mentions.filter((mention) => !isInCapitalsPassage(prose, mention.offset, mention.offset + mention.surface.length));

/** 名前に、すぐ前に書いた名（Jeffrey D. Walker の Jeffrey）を付ける。tokens は文書の順の語。 */
export const withGivenNames = (tokens: readonly Token[], source: string, mentions: readonly NameMention[]): NameMention[] => {
  const startAt = new Map(tokens.map((token, index) => [token.span.start, index]));
  return mentions.map((mention) => {
    const index = startAt.get(mention.offset);
    const givenName = index === undefined ? undefined : givenNameBefore(tokens, index, source);
    return givenName === undefined ? mention : { ...mention, givenName };
  });
};

/**
 * 会社のグループ（companyGroupBases）の一社の名前どうし（GitLab Ltd (UK) と GitLab LTD (Ireland)）か。形の語の書き方の違いも、
 * 別の会社を言い分けている。forms は会社の形の語（Inc、Ltd）。
 */
export const isGroupPairOf = (
  companies: readonly CompanyMention[],
  forms: readonly string[],
): ((found: { readonly name: string; readonly usual: string }) => boolean) => {
  const groups = [...companyGroupBases(companies)];
  const formKeys = forms.map(nameKey);
  const isGroupName = (surface: string): boolean => {
    const key = nameKey(surface);
    return groups.some((base) => formKeys.some((form) => key === base + form));
  };
  return ({ name, usual }) => isGroupName(name) && isGroupName(usual);
};

/** 位置を含む文の番号。文の外（見出し、表）は、その前の文の番号。 */
export const sentenceIndexOf = (doc: ProseDocument): ((offset: number) => number) => {
  const starts = doc.sentences.map((sentence) => sentence.span.start);
  const search = (offset: number, low: number, high: number): number => {
    if (low >= high) return low - 1;
    const middle = Math.floor((low + high) / 2);
    return (starts[middle] ?? 0) <= offset ? search(offset, middle + 1, high) : search(offset, low, middle);
  };
  return (offset) => search(offset, 0, starts.length);
};

/**
 * 文書が定義した語（“Company Subsidiary” means …）でない名前。定義した語は文書が作った呼び名で、同じ語を違う順に並べた所
 * （Subsidiary of the Company）はその中身を書いたふつうの言い方。
 */
export const notDefinedTerms = (doc: ProseDocument, names: readonly OrderName[]): OrderName[] => {
  const terms = new Set(doc.structure === undefined ? [] : definedTerms(doc.structure).map(({ term }) => term.toLowerCase()));
  return names.filter((name) => !terms.has(name.surface.toLowerCase()));
};
