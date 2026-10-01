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
