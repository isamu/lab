// 会社の名前の一語の終わりだけの違い。長い語の終わりの二字まで（Brightmoor と Brightmore、Lumenvale と Lumenvail）と、最後の語の
// 単数と複数（Water Utility と Water Utilities）。名前のほかの語は同じもの。

const LATIN_WORD = /^[a-z]+$/u;

/** 終わりの二字の違いを見る語の長さ。短い語（Alpha と Alpine）は別の名前のことが多い。 */
const MIN_ENDING_WORD_LENGTH = 8;
/** 頭からそろった字の後ろに残る字の数。 */
const MAX_ENDING_LENGTH = 2;

const wordsOf = (base: string): string[] =>
  base
    .toLowerCase()
    .split(/\s+/u)
    .filter((word) => word !== "");

/** 二つの名前の語の数が同じで、違うのが一語だけなら、その語の組と位置。 */
const differingWord = (left: string, right: string): { readonly pair: readonly [string, string]; readonly last: boolean } | undefined => {
  const [leftWords, rightWords] = [wordsOf(left), wordsOf(right)];
  const differing = leftWords.flatMap((word, index) => (word === rightWords[index] ? [] : [index]));
  const [at] = differing;
  const [leftWord, rightWord] = [leftWords[at ?? -1], rightWords[at ?? -1]];
  if (leftWords.length !== rightWords.length || differing.length !== 1 || leftWord === undefined || rightWord === undefined) return undefined;
  return { pair: [leftWord, rightWord], last: at === leftWords.length - 1 };
};

const sharedPrefix = (left: string, right: string): number => {
  const differ = [...left].findIndex((char, index) => char !== right.charAt(index));
  return differ < 0 ? left.length : differ;
};

/** 八字以上の英字の語の、頭がそろい、終わりの二字までだけが違うか（moor と more）。 */
export const isEndingApart = (left: string, right: string): boolean => {
  if (left === right || !LATIN_WORD.test(left) || !LATIN_WORD.test(right) || Math.min(left.length, right.length) < MIN_ENDING_WORD_LENGTH) return false;
  const prefix = sharedPrefix(left, right);
  return left.length - prefix <= MAX_ENDING_LENGTH && right.length - prefix <= MAX_ENDING_LENGTH;
};

/** 片方が他方の複数の形か（Tool と Tools、Box と Boxes、Utility と Utilities）。 */
export const isPluralOf = (singular: string, plural: string): boolean =>
  LATIN_WORD.test(singular) &&
  (plural === `${singular}s` || plural === `${singular}es` || (singular.endsWith("y") && plural === `${singular.slice(0, -1)}ies`));

/** 二つの会社の名前の部分が、一語の終わりだけ違うか。長い語の終わりの二字までか、最後の語の単数と複数。 */
export const isNameEndingSlip = (left: string, right: string): boolean => {
  const differing = differingWord(left, right);
  if (differing === undefined) return false;
  const [leftWord, rightWord] = differing.pair;
  return isEndingApart(leftWord, rightWord) || (differing.last && (isPluralOf(leftWord, rightWord) || isPluralOf(rightWord, leftWord)));
};
