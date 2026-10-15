import type { Token } from "./plugin.ts";

// 姓のすぐ前に書いた名（Jeffrey D. Walker の Jeffrey）。名の違う二人（Jeffrey D. Walker と Christopher J. Waller）は、姓が一字違いでも
// 別の人で、書き損じではない。

const GIVEN_NAME = /^\p{Lu}\p{Ll}+$/u;
const INITIAL = /^\p{Lu}$/u;
const NEWLINE = /\n/u;

const isInitial = (token: Token | undefined): boolean => INITIAL.test(token?.surface ?? "");

/** 名と名前のあいだの頭文字（D.、D）を飛ばした、名の語の添字。 */
const givenIndexOf = (tokens: readonly Token[], index: number): number => {
  if (tokens[index - 1]?.surface === "." && isInitial(tokens[index - 2])) return index - 3;
  return isInitial(tokens[index - 1]) ? index - 2 : index - 1;
};

/** 名前の書き方ごとの、すぐ前に書いた名のすべて。 */
export type GivenNames = ReadonlyMap<string, readonly string[]>;

export const givenNamesBySurface = (mentions: readonly { readonly surface: string; readonly givenName?: string | undefined }[]): GivenNames =>
  mentions.reduce((names, { surface, givenName }) => {
    const known = names.get(surface) ?? [];
    return givenName === undefined || known.includes(givenName) ? names : names.set(surface, [...known, givenName]);
  }, new Map<string, string[]>());

/** どちらの書き方にも名前のすぐ前の名があり、一つも同じでない（Jeffrey D. Walker と Christopher J. Waller）。別の人。 */
export const areOtherPeople = (left: readonly string[] = [], right: readonly string[] = []): boolean =>
  left.length > 0 && right.length > 0 && !left.some((name) => right.includes(name));

/**
 * tokens[index] で始まる名前のすぐ前の名。解析器が固有名詞と読んだ、大文字一字に小文字の続く語で、あいだに頭文字一つを挟んでよい。
 * 行を越えては読まない（一行に一人ずつ並べた出席者の名簿）。
 */
export const givenNameBefore = (tokens: readonly Token[], index: number, source: string): string | undefined => {
  const name = tokens[index];
  const given = tokens[givenIndexOf(tokens, index)];
  if (name === undefined || given === undefined || given.pos !== "PROPN" || !GIVEN_NAME.test(given.surface)) return undefined;
  return NEWLINE.test(source.slice(given.span.end, name.span.start)) ? undefined : given.surface;
};
