import { comparable, sameValue, type FactValue } from "./fact-values.ts";
import type { ScopedFact } from "./fact-scope.ts";
import type { FactConflict } from "./fact-conflicts.ts";

/**
 * 文書全体で一つの値を持つ項目（試用期間、probation period）。語彙表の語の名前の値は、節をまたいで比べる。比べるのは、表の升と
 * 文の値のあいだだけ: 表がその項目に一通りの値を書き、別の所の文がそれと違う値を書いたとき、文の値を言う。
 * 名前に条件を書いた値（正社員の試用期間）は名前が語彙表の語と違うので比べない。表どうし、文どうしは、雇用形態ごとに並べた
 * 節のことがあるので比べない。表が二通りの値を書いていれば、別々のものの値として言わない。
 */
export type TermWord = { readonly pattern: string; readonly group: string };

const folded = (text: string): string => text.normalize("NFKC").toLowerCase();

const MAX_DISTINCT = 2;

const distinctValues = (values: readonly FactValue[]): FactValue[] =>
  values.reduce<FactValue[]>((kept, value) => (kept.some((seen) => sameValue(seen, value)) ? kept : [...kept, value]), []);

const comparableClasses = (facts: readonly ScopedFact[]): ScopedFact[][] =>
  facts.reduce<ScopedFact[][]>((classes, fact) => {
    const home = classes.find((members) => members[0] !== undefined && comparable(members[0].value, fact.value));
    if (home === undefined) classes.push([fact]);
    else home.push(fact);
    return classes;
  }, []);

/** 同じ範囲で同じ名前の表の値と違う文の値は、同じ範囲の食い違い（scopeConflicts）が言う。 */
const sameScopeAs = (fact: ScopedFact, tableFacts: readonly ScopedFact[]): boolean =>
  tableFacts.some((cell) => cell.scope === fact.scope && cell.key === fact.key);

const conflictsInClass = (facts: readonly ScopedFact[]): FactConflict[] => {
  const cells = facts.filter((fact) => fact.table === true);
  const [cell, ...others] = distinctValues(cells.map((fact) => fact.value));
  if (cell === undefined || others.length > 0) return [];
  if (distinctValues(facts.map((fact) => fact.value)).length !== MAX_DISTINCT) return [];
  return facts.filter((fact) => fact.table !== true && !sameValue(cell, fact.value) && !sameScopeAs(fact, cells)).map((fact) => ({ fact, other: cell }));
};

const groupOf = (fact: ScopedFact, words: readonly TermWord[]): string | undefined => words.find((word) => folded(word.pattern) === fact.key)?.group;

/** 語彙表の項目ごとに、表の値と違う文の値。記録の欄（繰り返す名前）は比べない。 */
export const documentTermConflicts = (facts: readonly ScopedFact[], words: readonly TermWord[]): FactConflict[] => {
  const groups = new Map<string, ScopedFact[]>();
  facts.forEach((fact) => {
    const group = groupOf(fact, words);
    if (group === undefined || fact.record) return;
    groups.set(group, [...(groups.get(group) ?? []), fact]);
  });
  return [...groups.values()].flatMap((members) => comparableClasses(members).flatMap(conflictsInClass));
};
