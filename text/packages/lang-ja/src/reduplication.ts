import type { Lexicon, Token } from "chaffjs/plugin";

/**
 * 名詞を重ねて「それぞれの」を言う形（会社会社で、部署部署の）。重ねられるのは、まとまりや場合を指す名詞だけで、
 * 後ろに助詞が続く。二つ目の名詞に UD の Echo=Rdp を付ける。「資料資料の」「確認確認する」は書き損じのまま。
 */
export type Distributive = { readonly nouns: ReadonlySet<string>; readonly particles: ReadonlySet<string> };

const patternsOf = (lexicon: Lexicon | undefined): ReadonlySet<string> => new Set((lexicon ?? []).map((entry) => entry.pattern));

export const distributiveVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): Distributive => ({
  nouns: patternsOf(lexicons["distributive-noun"]),
  particles: patternsOf(lexicons["distributive-particle"]),
});

const isSameNoun = (first: Token | undefined, second: Token, nouns: ReadonlySet<string>): boolean =>
  first !== undefined &&
  first.pos === "NOUN" &&
  second.pos === "NOUN" &&
  first.surface === second.surface &&
  first.span.end === second.span.start &&
  nouns.has(second.surface);

const isParticleAfter = (next: Token | undefined, second: Token, particles: ReadonlySet<string>): boolean =>
  next !== undefined && next.pos === "ADP" && next.span.start === second.span.end && particles.has(next.surface);

const echoed = (token: Token): Token => ({ ...token, features: { ...token.features, Echo: "Rdp" } });

const isDistributive = (tokens: readonly Token[], index: number, vocabulary: Distributive): boolean => {
  const token = tokens[index];
  return token !== undefined && isSameNoun(tokens[index - 1], token, vocabulary.nouns) && isParticleAfter(tokens[index + 1], token, vocabulary.particles);
};

/** 文字列を解析器が一語の副詞と読むか。解析器を持つ index.ts が渡す。 */
export type ReadsAsAdverb = (text: string) => boolean;

const CONTENT_WORD = new Set(["NOUN", "VERB", "ADJ"]);

/**
 * 重ね言葉の副詞（がんがん）は、前の語に引かれると同じ名詞二つに切られる（労働者ががんがん → が・がん・がん）。
 * 二語を続けて読み直して一語の副詞なら、重ね言葉。機能語の重なりは読み直さない。書き損じの「行ったたので」の「たた」も一語の副詞に読める。
 */
const isSplitAdverb = (first: Token | undefined, second: Token, readsAsAdverb: ReadsAsAdverb): boolean =>
  first !== undefined &&
  first.surface === second.surface &&
  first.pos === second.pos &&
  CONTENT_WORD.has(second.pos) &&
  first.span.end === second.span.start &&
  readsAsAdverb(`${first.surface}${second.surface}`);

export const markReduplication = (tokens: readonly Token[], vocabulary: Distributive, readsAsAdverb: ReadsAsAdverb): Token[] =>
  tokens.map((token, index) => (isDistributive(tokens, index, vocabulary) || isSplitAdverb(tokens[index - 1], token, readsAsAdverb) ? echoed(token) : token));
