import { minorityStyle } from "./orthography.ts";

/**
 * 少ないほうがこの割合を超えると、書き損じではなく、書き方が二通りある文書と読む。1 箇所ずつ「違う」と指すと、
 * 半々に近い文書でどちらかの側に立つことになる。そのときは 1 件にまとめて、両方の数を言う。
 */
const MIXED_SHARE = 0.2;

/** 割合が大きくても、これより少なければ 1 箇所ずつ言う。3 箇所のうち 1 箇所なら、その 1 箇所を見せるほうが早い。 */
const MIN_MIXED = 5;

/** each は少ないほうを 1 箇所ずつ、mixed は文書に書き方が二通りあることを 1 件で。first は少ないほうの最初の箇所。 */
export type MinorityReport<T> =
  | { readonly mode: "each"; readonly odd: readonly T[] }
  | { readonly mode: "mixed"; readonly first: T; readonly odd: number; readonly spaced: number; readonly touching: number };

/** 一つの種類の境目から、何をどう言うか。混ざっていない、または少ないほうが limit に届かなければ言わない。 */
export const minorityReport = <T extends { readonly spaced: boolean }>(ofKind: readonly T[], limit: number): MinorityReport<T> | undefined => {
  const minority = minorityStyle(ofKind);
  if (minority === undefined) return undefined;
  const odd = ofKind.filter((entry) => entry.spaced === minority);
  const first = odd[0];
  if (first === undefined || odd.length < limit) return undefined;
  if (odd.length < MIN_MIXED || odd.length <= ofKind.length * MIXED_SHARE) return { mode: "each", odd };
  const spaced = ofKind.filter((entry) => entry.spaced).length;
  return { mode: "mixed", first, odd: odd.length, spaced, touching: ofKind.length - spaced };
};
