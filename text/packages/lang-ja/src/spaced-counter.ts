import type { Token } from "chaffjs/plugin";

/**
 * 「10 回」「3 日」「26.7 万行」のように数と空白 1 つを挟んだ助数詞は、解析器が普通の名詞や地名（日 = 日本）と読む。
 * 詰めて書けば数につく語（助数詞、桁の語で始まる語）と読まれる語は、NOUN, NounType=Class に直す。数そのもの（万）はそのまま。
 * 読み直しは解析器が要るので、呼ぶ側（pos.ts）が渡す。ここは並びを見るだけ。
 */
export type CounterReading = (number: string, word: string) => boolean;

/** 数と語のあいだに置かれうる空白 1 文字。quantities.ts の GAP と同じ。 */
const GAP = new Set([" ", "\t", "　"]);

const isNumber = (token: Token | undefined): boolean => token?.features?.["NumType"] === "Card";

const isCounter = (token: Token): boolean => token.features?.["NounType"] === "Class";

/** token の直前が、空白 1 つを挟んだ数か。三つが隙間なく並んでいるときだけ。 */
const numberBeforeGap = (tokens: readonly Token[], index: number): Token | undefined => {
  const [number, gap, token] = [tokens[index - 2], tokens[index - 1], tokens[index]];
  if (number === undefined || !isNumber(number) || gap === undefined || token === undefined || !GAP.has(gap.surface)) return undefined;
  return number.span.end === gap.span.start && gap.span.end === token.span.start ? number : undefined;
};

const asCounter = (token: Token): Token => ({
  span: token.span,
  surface: token.surface,
  pos: "NOUN",
  ...(token.lemma === undefined ? {} : { lemma: token.lemma }),
  // 解析器が読む助数詞（名詞,接尾,助数詞）と同じ印。数に付いて単独では語にならない。
  features: { NounType: "Class", Bound: "Yes" },
});

export const markSpacedCounters = (tokens: readonly Token[], readsAsCounter: CounterReading): Token[] =>
  tokens.map((token, index) => {
    const number = numberBeforeGap(tokens, index);
    if (number === undefined || isCounter(token) || isNumber(token)) return token;
    return readsAsCounter(number.surface, token.surface) ? asCounter(token) : token;
  });
