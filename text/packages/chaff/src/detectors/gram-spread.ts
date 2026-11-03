import { lengthOf } from "../measure.ts";
import type { LengthUnit, Sentence } from "../plugin.ts";

/** 文の位置: その文より前の文の長さの合計（文書の長さの単位）。表や符号の塊は文ではないので、読む長さに入らない。 */
export const sentencePositions = (sentences: readonly Sentence[], unit: LengthUnit): ReadonlyMap<Sentence, number> => {
  const positions = new Map<Sentence, number>();
  sentences.reduce((position, sentence) => {
    positions.set(sentence, position);
    return position + lengthOf(sentence, unit);
  }, 0);
  return positions;
};

/** 位置を count 個含む一番短い範囲の長さ。位置が count 個に満たなければ undefined。 */
export const narrowestStretch = (positions: readonly number[], count: number): number | undefined => {
  if (count < 1 || positions.length < count) return undefined;
  const sorted = positions.toSorted((left, right) => left - right);
  return Math.min(...sorted.slice(count - 1).map((last, index) => last - (sorted[index] ?? last)));
};
