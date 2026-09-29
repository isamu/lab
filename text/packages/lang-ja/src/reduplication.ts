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

export const markReduplication = (tokens: readonly Token[], vocabulary: Distributive): Token[] =>
  tokens.map((token, index) =>
    isSameNoun(tokens[index - 1], token, vocabulary.nouns) && isParticleAfter(tokens[index + 1], token, vocabulary.particles) ? echoed(token) : token,
  );
