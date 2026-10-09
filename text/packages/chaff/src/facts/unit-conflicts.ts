import type { ScopedFact } from "./fact-scope.ts";
import { sameMeasure, type Measured } from "./measures.ts";
import { toleranceOf } from "./unit-tolerance.ts";

/**
 * 同じ名前の量を、違う単位で書いて、換算すると合わない（「距離：5 km」と「距離：3000 m」）。比べるのは同じ範囲の、同じ種類の量で、
 * 単位が違うものだけ。同じ単位どうしの食い違いは fact-conflict が見る。丸めた書き方（1 mile と 1.6 km）は、差が量の種類ごとの許す差（unit-tolerance）以内なら合う。
 */
export type UnitConflict = { readonly fact: ScopedFact; readonly measured: Measured; readonly other: Measured };

const groupKey = (fact: ScopedFact): string => `${fact.scope}\u0000${fact.key}`;

type Read = { readonly fact: ScopedFact; readonly measured: Measured };

/**
 * 一つの種類（長さなら長さ）の量のうち、前にある単位の違う量のどれとも換算して合わないもの。どれか一つと合えば、食い違いは同じ単位
 * どうし（3 km と 5 km）の側にあり、fact-conflict が見る。
 */
const conflictsInDimension = (reads: readonly Read[]): UnitConflict[] =>
  reads.flatMap(({ fact, measured }, index) => {
    const others = reads.slice(0, index).filter((earlier) => earlier.measured.unit !== measured.unit);
    const [first] = others;
    if (first === undefined || others.some((earlier) => sameMeasure(earlier.measured, measured, toleranceOf(measured.dimension)))) return [];
    return [{ fact, measured, other: first.measured }];
  });

const conflictsIn = (reads: readonly Read[]): UnitConflict[] => {
  if (reads.some(({ fact }) => fact.record)) return [];
  const dimensions = [...new Set(reads.map(({ measured }) => measured.dimension))];
  return dimensions.flatMap((dimension) => conflictsInDimension(reads.filter(({ measured }) => measured.dimension === dimension)));
};

/** 範囲と名前ごとに、最初の量と単位の違う量を換算して比べる。 */
export const unitConflicts = (facts: readonly ScopedFact[], measuredOf: (fact: ScopedFact) => Measured | undefined): UnitConflict[] => {
  const groups = new Map<string, Read[]>();
  facts.forEach((fact) => {
    const measured = measuredOf(fact);
    if (measured === undefined) return;
    const group = groups.get(groupKey(fact));
    if (group === undefined) groups.set(groupKey(fact), [{ fact, measured }]);
    else group.push({ fact, measured });
  });
  return [...groups.values()].flatMap(conflictsIn);
};
