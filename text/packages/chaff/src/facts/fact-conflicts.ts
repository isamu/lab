import { comparable, sameValue, type FactValue } from "./fact-values.ts";
import type { ScopedFact } from "./fact-scope.ts";

/**
 * 同じ名前に違う値。比べるのは同じ種類で比べられる値どうし（同じ単位の数量、重なる細かさの日付、名前）。
 * 一つの範囲の中で値が二通りなら、最初に書いた値と違うほうを言う。三通り以上なら、催しごとに並べた一覧と読んで言わない。
 * 要約や冒頭の値は、本文の同じ名前の値と比べる。本文の値が一通りに揃っていて、要約の値がそれと違うときだけ言う。
 */
export type FactConflict = { readonly fact: ScopedFact; readonly other: FactValue };

const MAX_DISTINCT = 2;

const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string): T[][] => {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [item]);
    else group.push(item);
  });
  return [...groups.values()];
};

/** 互いに違う値。同じ値（3,000円と3000円、10月5日と2026年10月5日）は一つに数える。 */
const distinctValues = (values: readonly FactValue[]): FactValue[] =>
  values.reduce<FactValue[]>((kept, value) => (kept.some((seen) => sameValue(seen, value)) ? kept : [...kept, value]), []);

/** 互いに比べられる値の組に分ける（単位ごと、日付の細かさごと）。比べられない値は、別の組で比べる。 */
const comparableClasses = (facts: readonly ScopedFact[]): ScopedFact[][] =>
  facts.reduce<ScopedFact[][]>((classes, fact) => {
    const home = classes.find((members) => members[0] !== undefined && comparable(members[0].value, fact.value));
    if (home === undefined) classes.push([fact]);
    else home.push(fact);
    return classes;
  }, []);

/** 一つの組の中で値が二通りなら、最初の値と違う事実。 */
const conflictsInClass = (facts: readonly ScopedFact[]): FactConflict[] => {
  const [first, ...rest] = facts;
  if (first === undefined) return [];
  if (distinctValues(facts.map((fact) => fact.value)).length !== MAX_DISTINCT) return [];
  return rest.filter((fact) => !sameValue(first.value, fact.value)).map((fact) => ({ fact, other: first.value }));
};

/** 記録の欄（繰り返す名前）は比べない。 */
const conflictsIn = (facts: readonly ScopedFact[]): FactConflict[] =>
  facts.some((fact) => fact.record) ? [] : comparableClasses(facts).flatMap(conflictsInClass);

/** 同じ範囲の中で、同じ名前に二通りの値。 */
export const scopeConflicts = (facts: readonly ScopedFact[]): FactConflict[] => groupBy(facts, (fact) => `${fact.scope}\u0000${fact.key}`).flatMap(conflictsIn);

const isSummary = (fact: ScopedFact): boolean => fact.part !== "body";

/** 要約か冒頭の値が、本文で揃って書かれた値と違う。 */
const summaryConflict = (fact: ScopedFact, body: readonly ScopedFact[]): FactConflict[] => {
  const values = distinctValues(body.filter((other) => other.key === fact.key && comparable(fact.value, other.value)).map((other) => other.value));
  const only = values.length === 1 ? values[0] : undefined;
  return only === undefined || sameValue(fact.value, only) ? [] : [{ fact, other: only }];
};

export const summaryConflicts = (facts: readonly ScopedFact[]): FactConflict[] => {
  const body = facts.filter((fact) => !isSummary(fact) && !fact.record);
  return facts.filter(isSummary).flatMap((fact) => summaryConflict(fact, body));
};
