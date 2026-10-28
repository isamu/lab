import type { Token } from "./plugin.ts";

/** The particle that offers alternatives (連続的か断続的か): the words it joins are the options of one choice. */
const ALTERNATIVE = "か";

const isSkippable = (token: Token): boolean => token.pos === "NOUN" || token.pos === "PROPN" || token.surface === "、" || token.surface.trim() === "";

/**
 * Of the counted tokens (by index into tokens), those that are a later option of a choice (連続的か断続的か、一時的): an earlier
 * counted token is followed by か, and only nouns, a 、 or spaces stand between that か and this one. The options of one choice
 * are one point the sentence makes, so only the first of them counts.
 */
export const laterAlternatives = (tokens: readonly Token[], counted: readonly number[]): ReadonlySet<number> =>
  new Set(
    counted.filter((at, k) => {
      const previous = counted[k - 1];
      if (previous === undefined || tokens[previous + 1]?.surface !== ALTERNATIVE) return false;
      return tokens.slice(previous + 2, at).every(isSkippable);
    }),
  );

const isJoiningNoun = (token: Token): boolean => token.pos === "NOUN" || token.pos === "PROPN";

/**
 * Of the counted tokens, those written straight onto the one before with only nouns between (信仰的主観的, 時間的空間的,
 * 気候学的地理学的): the pair names one combined quality, so only the first counts. A particle, a comma or な between them
 * (効果的かつ効率的, 経済的、社会的) keeps them two.
 */
export const laterJoined = (tokens: readonly Token[], counted: readonly number[]): ReadonlySet<number> =>
  new Set(
    counted.filter((at, k) => {
      const previous = counted[k - 1];
      return previous !== undefined && at - previous > 1 && tokens.slice(previous + 1, at).every(isJoiningNoun);
    }),
  );
