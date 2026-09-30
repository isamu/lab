import type { Span } from "../plugin.ts";

/** 1 文字ずつずらした、幅 width の窓。 */
export const charWindows = (text: string, width: number): Span[] =>
  Array.from({ length: Math.max(0, text.length - width + 1) }, (_, start) => ({ start, end: start + width }));

/** first 番目の語から数えて、minLength 文字に届く最初の語。届く前に尽きるのは minLength 文字に満たない末尾だけなので、深くならない。 */
const reachingWord = (words: readonly Span[], first: number, minLength: number): Span | undefined => {
  const start = words[first]?.start ?? 0;
  const step = (index: number): Span | undefined => {
    const word = words[index];
    if (word === undefined || word.end - start >= minLength) return word;
    return step(index + 1);
  };
  return step(first);
};

/** 語。前後の句読点と括弧は含めない。"described," と "described" を別の語句として数えないため。 */
const WORD = /[\p{L}\p{N}](?:\S*[\p{L}\p{N}])?/gu;

/**
 * 語の頭で始まり語の尾で終わる窓。語を 1 つずつ足して、minLength 文字に届いた最短のもの。
 * 文字で切ると " generat" や "roductivity change a" のような語の断片が数えられる。
 */
export const wordWindows = (text: string, minLength: number): Span[] => {
  const words = [...text.matchAll(WORD)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
  return words.flatMap((first, index) => {
    const last = reachingWord(words, index, minLength);
    return last === undefined ? [] : [{ start: first.start, end: last.end }];
  });
};
