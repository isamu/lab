import type { Lexicon, Token } from "chaffjs/plugin";

/**
 * 名詞を重ねて「それぞれの」を言う形（会社会社で、部署部署の）。重ねる名詞は決まっておらず、後ろに助詞が続く。
 * 二つ目の名詞に UD の Echo=Rdp を付ける。「確認確認する」「資料資料を」のような書き損じは、この助詞が続かない。
 */
export const distributiveParticles = (lexicons: Readonly<Record<string, Lexicon>>): ReadonlySet<string> =>
  new Set((lexicons["distributive-particle"] ?? []).map((entry) => entry.pattern));

const isSameNoun = (first: Token | undefined, second: Token): boolean =>
  first !== undefined && first.pos === "NOUN" && second.pos === "NOUN" && first.surface === second.surface && first.span.end === second.span.start;

const isParticleAfter = (next: Token | undefined, second: Token, particles: ReadonlySet<string>): boolean =>
  next !== undefined && next.pos === "ADP" && next.span.start === second.span.end && particles.has(next.surface);

const echoed = (token: Token): Token => ({ ...token, features: { ...token.features, Echo: "Rdp" } });

export const markReduplication = (tokens: readonly Token[], particles: ReadonlySet<string>): Token[] =>
  tokens.map((token, index) => (isSameNoun(tokens[index - 1], token) && isParticleAfter(tokens[index + 1], token, particles) ? echoed(token) : token));
