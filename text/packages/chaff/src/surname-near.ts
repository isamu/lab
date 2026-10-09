// 名が同じ人の名前の、姓だけの書き損じ（Whitford と Whitfield）。一字違い（isNearWord）より遠い違いを、英字の長い姓に限って見る。

const LATIN_WORD = /^[a-z]+$/u;

/** 二字違いまで見る姓の長さ。短い姓（Martin と Marten、Hansen と Hanson）は別の姓のことが多い。 */
const MIN_SURNAME_LENGTH = 7;
/** 頭からそろう字の数。頭が違えば別の姓（Robertson と Robinson）。 */
const MIN_SURNAME_PREFIX = 4;
/** 頭と終わりのそろった字のあいだに残る字の数。短いほうで二字まで、長いほうで三字まで（Whitford の or と Whitfield の iel）。 */
const MAX_SURNAME_GAP = 2;

const sharedPrefix = (left: string, right: string): number => {
  const differ = [...left].findIndex((char, index) => char !== right.charAt(index));
  return differ < 0 ? left.length : differ;
};

/**
 * 二つの英字の姓が、頭が四字以上そろい、終わりの字もそろい、あいだの二字（長いほうは三字）までだけ違うか。どちらも七字以上で。
 * 終わりだけの違い（Whitford と Whitfords）は語の形の違い。
 */
export const isNearSurname = (left: string, right: string): boolean => {
  if (left === right || !LATIN_WORD.test(left) || !LATIN_WORD.test(right) || Math.min(left.length, right.length) < MIN_SURNAME_LENGTH) return false;
  const prefix = sharedPrefix(left, right);
  if (prefix < MIN_SURNAME_PREFIX) return false;
  const [leftRest, rightRest] = [left.slice(prefix), right.slice(prefix)];
  const suffix = sharedPrefix([...leftRest].toReversed().join(""), [...rightRest].toReversed().join(""));
  if (suffix === 0) return false;
  const gaps = [leftRest.length - suffix, rightRest.length - suffix].toSorted((first, second) => first - second);
  const [shorter = 0, longer = 0] = gaps;
  return shorter <= MAX_SURNAME_GAP && longer <= MAX_SURNAME_GAP + 1;
};
