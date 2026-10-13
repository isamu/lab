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

/** 同数のとき、書き方が二通りあると 1 件で言う最少の数。1 対 1 は一つずつの書き違いとも区別がつかないので言わない。 */
const MIN_TIE = 2;

/**
 * 二通りが同じ数なら少ないほうは無く、1 箇所ずつ「違う」と指すとどちらかの側に立つ。MIN_TIE 対 MIN_TIE 以上なら書き方が二通りあることを 1 件で言い、
 * それより少なければ言わない。同数でなければ report のまま。
 */
export const withoutSideOnTie = <T extends { readonly spaced: boolean }>(
  report: MinorityReport<T> | undefined,
  ofKind: readonly T[],
): MinorityReport<T> | undefined => {
  if (report?.mode !== "each" || report.odd.length * 2 !== ofKind.length) return report;
  const first = ofKind[0];
  if (report.odd.length < MIN_TIE || first === undefined) return undefined;
  return { mode: "mixed", first, odd: report.odd.length, spaced: report.odd.length, touching: report.odd.length };
};
