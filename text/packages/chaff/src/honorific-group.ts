import type { Token } from "./plugin.ts";

const touches = (left: Token | undefined, right: Token | undefined): boolean => left !== undefined && right !== undefined && left.span.end === right.span.start;

/**
 * 人の集まりを敬って呼ぶ語（皆様、方々）の直前の助詞で、呼び方がさらに同じ助詞で次の語に係るもの。「国民の皆様の期待」の
 * 「国民の皆様」は一つの呼び方として次の語に係り、その中の「の」は入れ子を深くしない。呼び方で連なりが終わるとき
 * （それ以外の全てのVim使いの皆様が）は、呼び方が連なりの頭の語なので数える。particles は数える助詞（の）、groups は呼び方の語（皆様）。
 */
export const honorificGroupParticles = (tokens: readonly Token[], particles: readonly string[], groups: readonly string[]): ReadonlySet<Token> =>
  new Set(
    tokens.filter((token, at) => {
      const [group, after] = [tokens[at + 1], tokens[at + 2]];
      return (
        particles.includes(token.surface) &&
        groups.includes(group?.surface ?? "") &&
        touches(token, group) &&
        touches(group, after) &&
        particles.includes(after?.surface ?? "")
      );
    }),
  );
