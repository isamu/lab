// 人の名前で、形が似ていて取り違えやすい別の字（太 と 大、未 と 末）。どの字が似ているかは語彙表 name-lookalike-char が組（group）
// ごとに言う。

/** 字から、その組の代表の字へ。 */
export type LookalikeChars = ReadonlyMap<string, string>;

export const NO_LOOKALIKES: LookalikeChars = new Map();

/** 組のある字を組の代表に寄せた形。組の字を含まない名前は、この比べ方に入らない。 */
export const lookalikeKeysOf = (surface: string, lookalikes: LookalikeChars): string[] => {
  const chars = [...surface];
  return chars.some((char) => lookalikes.has(char)) ? [chars.map((char) => lookalikes.get(char) ?? char).join("")] : [];
};

const isSameGroup = (left: string, right: string, lookalikes: LookalikeChars): boolean => {
  const group = lookalikes.get(left);
  return group !== undefined && group === lookalikes.get(right);
};

/** 字数が同じで、同じ位置の一字だけが違い、その二字が同じ組にある（山本 健太 と 山本 健大）。 */
export const isLookalikeApart = (left: string, right: string, lookalikes: LookalikeChars): boolean => {
  const [leftChars, rightChars] = [[...left], [...right]];
  if (leftChars.length !== rightChars.length) return false;
  const differ = leftChars.flatMap((char, index) => (char === rightChars[index] ? [] : [index]));
  const [at] = differ;
  return differ.length === 1 && at !== undefined && isSameGroup(leftChars[at] ?? "", rightChars[at] ?? "", lookalikes);
};
