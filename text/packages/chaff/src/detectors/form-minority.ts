// 一つの文書の中で、同じものを何通りかに書いたときの少ないほう。どの書き方が正しいかは決めない。

/** 少ないほうの書き方のものと、いちばん多い書き方の例。 */
export type FormMinority<T> = { readonly odd: readonly T[]; readonly usual: T };

const PERCENT = 100;

/**
 * いちばん多い書き方と違うもの。少ないほうが limit パーセントを超えれば使い分けている文書と読んで言わない。
 * いちばん多い書き方が同じ数で並べば、どちらにも立たない。
 */
export const formMinority = <T extends { readonly form: string }>(items: readonly T[], limit: number): FormMinority<T> | undefined => {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item.form, (counts.get(item.form) ?? 0) + 1));
  const [top, second] = [...counts].toSorted((left, right) => right[1] - left[1]);
  if (top === undefined || second === undefined || top[1] === second[1]) return undefined;
  const odd = items.filter((item) => item.form !== top[0]);
  const usual = items.find((item) => item.form === top[0]);
  if (usual === undefined || odd.length * PERCENT > items.length * limit) return undefined;
  return { odd, usual };
};
