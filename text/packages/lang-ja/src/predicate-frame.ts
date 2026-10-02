import type { Token } from "chaffjs/plugin";

const lemmaOf = (token: Token): string => token.lemma ?? token.surface;

/** at から読んだ語の原形をつないで、frame とちょうど同じになる語の数。ならなければ 0。語は 1 字以上なので、frame の字数より多くは読まない。 */
const lengthOf = (tokens: readonly Token[], at: number, frame: string): number => {
  const lemmas = tokens.slice(at, at + frame.length).map(lemmaOf);
  return lemmas.map((_lemma, index) => lemmas.slice(0, index + 1).join("")).indexOf(frame) + 1;
};

/**
 * at から始まる述語の型（「ことになる」「こととなる」）の語の数。型の名詞は修飾される名詞ではなく、述語の一部。
 * 「検討されることとなった」の「こと」は、受動を名詞の修飾にしない。原形で照らすので、活用した形（なりました）にも当たる。
 */
export const predicateFrameAt = (tokens: readonly Token[], at: number, frames: readonly string[]): number =>
  Math.max(0, ...frames.map((frame) => lengthOf(tokens, at, frame)));

/** 型のすぐ後ろで仮定の節を作る語（「検討されることとなれば」「〜ことになると」）。起きたことではなく、その前提を言う。 */
const CONDITIONAL = new Set(["ば", "と"]);

/**
 * at から始まる述語の型と、その後ろが仮定の節かどうか。型が無ければ undefined。
 * 型の名詞（こと・事）は非自立名詞なので、型の後ろの名詞を読む側は非自立名詞を数えなければ型を読み飛ばせる。
 */
export const predicateFrameAfter = (tokens: readonly Token[], at: number, frames: readonly string[]): { readonly conditional: boolean } | undefined => {
  const length = predicateFrameAt(tokens, at, frames);
  return length === 0 ? undefined : { conditional: CONDITIONAL.has(tokens[at + length]?.surface ?? "") };
};
