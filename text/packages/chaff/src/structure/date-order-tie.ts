import { versionsAlong } from "./version-order.ts";

/**
 * 隣どうしの二つの日付が入れ替わったように見えて、どちらを取り除いても同じだけ揃う（引き分け）とき、同じ項目の手がかりで決める。
 * 項目がみな版を持ち、版が向きに沿って並ぶなら、並びの位置は版が裏付ける。位置に照らして逆らう相手の多い日付を指す。
 * 版が無いか、版も乱れているなら、二つだけが入れ替わった並びに限り、外側の隣（前の日付の前、後ろの日付の後ろ）から遠いほうを指す。書き間違えた日付は隣から跳ぶ。
 * どちらでも決まらなければ undefined（呼ぶ側はこれまでどおり後ろを指す）。
 */
export type TieEntry = { readonly value: string; readonly version: string | undefined };

const DAY_MS = 86_400_000;
const MONTHS_PER_YEAR = 12;
/** 年の無い月日（09-14）を日数にするための、閏年の仮の年。 */
const LEAP_YEAR = 2000;

/** 同じ書き方の日付どうしで差をとれる数。年月日と月日は日数、年月は月数。 */
const pointOf = (value: string): number | undefined => {
  const full = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (full !== null) return Date.UTC(Number(full[1]), Number(full[2]) - 1, Number(full[3])) / DAY_MS;
  const month = /^(\d{4})-(\d{2})$/u.exec(value);
  if (month !== null) return Number(month[1]) * MONTHS_PER_YEAR + Number(month[2]);
  const day = /^(\d{2})-(\d{2})$/u.exec(value);
  return day === null ? undefined : Date.UTC(LEAP_YEAR, Number(day[1]) - 1, Number(day[2])) / DAY_MS;
};

/** 位置に照らして向きに逆らう相手の数。 */
const disagreements = (values: readonly string[], index: number, direction: number): number =>
  values.filter((other, at) => {
    if (at === index) return false;
    const [earlier, later] = at < index ? [other, values[index] ?? ""] : [values[index] ?? "", other];
    return Math.sign(later.localeCompare(earlier)) === -direction;
  }).length;

/** 多いほうを指す。同じなら決めない。 */
const larger = (before: number, after: number, scores: readonly [number, number]): number | undefined => {
  if (scores[0] === scores[1]) return undefined;
  return scores[0] > scores[1] ? before : after;
};

const byVersion = (entries: readonly TieEntry[], before: number, after: number, direction: number): number | undefined => {
  if (
    !versionsAlong(
      entries.map((entry) => entry.version),
      direction,
    )
  )
    return undefined;
  const values = entries.map((entry) => entry.value);
  return larger(before, after, [disagreements(values, before, direction), disagreements(values, after, direction)]);
};

const distance = (entries: readonly TieEntry[], from: number, to: number): number | undefined => {
  const start = pointOf(entries[from]?.value ?? "");
  const end = pointOf(entries[to]?.value ?? "");
  return start === undefined || end === undefined ? undefined : Math.abs(end - start);
};

/** from から to へ、向きに逆らわない（等しくてもよい）。 */
const along = (from: string, to: string, direction: number): boolean => Math.sign(to.localeCompare(from)) !== -direction;

/** 隣どうしの入れ替わりだけ: 外側の二つが向きに沿い、入れ替わった二つがどちらもその間に収まる。乱れが広い並びでは、外側の隣も当てにならない。 */
const isSwap = (values: readonly string[], before: number, after: number, direction: number): boolean => {
  const [outerBefore, outerAfter] = [values[before - 1], values[after + 1]];
  if (outerBefore === undefined || outerAfter === undefined) return false;
  return [values[before] ?? "", values[after] ?? ""].every((value) => along(outerBefore, value, direction) && along(value, outerAfter, direction));
};

const byGap = (entries: readonly TieEntry[], before: number, after: number, direction: number): number | undefined => {
  if (
    !isSwap(
      entries.map((entry) => entry.value),
      before,
      after,
      direction,
    )
  )
    return undefined;
  const outerBefore = distance(entries, before - 1, before);
  const outerAfter = distance(entries, after, after + 1);
  if (outerBefore === undefined || outerAfter === undefined) return undefined;
  return larger(before, after, [outerBefore, outerAfter]);
};

/** 引き分けの二つ（before = at - 1、after = at）のうち外れたほう。決まらなければ undefined。 */
export const breakDateTie = (entries: readonly TieEntry[], before: number, after: number, direction: number): number | undefined =>
  byVersion(entries, before, after, direction) ?? byGap(entries, before, after, direction);
