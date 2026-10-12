import type { NameMention } from "./name-variants.ts";

// 人の名前で、形が似ていて取り違えやすい別の字（太 と 大、未 と 末）。どの字が似ているかは語彙表 name-lookalike-char が組（group）
// ごとに言う。読みが違うので、読みの同じ名前の見方では比べられない。

/** 字から、その組の代表の字へ。 */
export type LookalikeChars = ReadonlyMap<string, string>;

export const NO_LOOKALIKES: LookalikeChars = new Map();

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

/** 書き方ごとの最初の現れと数。姓と名のそろった（二語以上の）人の名前だけ。 */
const fullPersonNamesOf = (mentions: readonly NameMention[]): Map<string, { readonly first: NameMention; readonly count: number }> => {
  const names = new Map<string, { readonly first: NameMention; readonly count: number }>();
  mentions
    .filter((mention) => mention.person === true && mention.words.length >= 2)
    .forEach((mention) => {
      const known = names.get(mention.surface);
      names.set(mention.surface, { first: known?.first ?? mention, count: (known?.count ?? 0) + 1 });
    });
  return names;
};

export type LookalikeSlip = { readonly mention: NameMention; readonly usual: string };

/**
 * 姓と名のそろった人の名前が、形の似た別の字一字だけで違う所（山本 健太 と 山本 健大）。兄弟（健太 と 健大）もありうるので、
 * 多いほうが二度以上、少ないほうが一度だけのときに限る。相手が二つあれば多いほう、同数なら先に書いたほう。
 */
export const lookalikeSlipsIn = (mentions: readonly NameMention[], lookalikes: LookalikeChars): LookalikeSlip[] => {
  const names = [...fullPersonNamesOf(mentions).values()];
  return names
    .filter((name) => name.count === 1)
    .flatMap((slip) => {
      const usual = names
        .filter((other) => other.count >= 2 && isLookalikeApart(slip.first.surface, other.first.surface, lookalikes))
        .toSorted((left, right) => right.count - left.count || left.first.offset - right.first.offset)[0];
      return usual === undefined ? [] : [{ mention: slip.first, usual: usual.first.surface }];
    });
};
