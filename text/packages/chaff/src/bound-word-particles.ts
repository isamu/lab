import type { Token } from "./plugin.ts";

const touches = (left: Token | undefined, right: Token | undefined): boolean => left !== undefined && right !== undefined && left.span.end === right.span.start;

/**
 * 前の語と組んで一つの名前になる語（敬って呼ぶ語の皆様、置き場所を言う語の下）の直前の助詞で、組んだ名前がさらに同じ助詞で次の語に
 * 係るもの。「国民の皆様の期待」の「国民の皆様」、「ラックの下の段」の「ラックの下」は一つの名前として次の語に係り、その中の「の」は
 * 入れ子を深くしない。組んだ語で連なりが終わるとき（それ以外の全てのVim使いの皆様が）は、連なりの頭の語なので数える。
 * particles は数える助詞（の）、words は組む語（皆様、下）。
 */
export const boundWordParticles = (tokens: readonly Token[], particles: readonly string[], words: readonly string[]): ReadonlySet<Token> =>
  new Set(
    tokens.filter((token, at) => {
      const [word, after] = [tokens[at + 1], tokens[at + 2]];
      return (
        particles.includes(token.surface) &&
        words.includes(word?.surface ?? "") &&
        touches(token, word) &&
        touches(word, after) &&
        particles.includes(after?.surface ?? "")
      );
    }),
  );
