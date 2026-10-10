import { comparable, sameValue, type FactValue } from "./fact-values.ts";
import type { ScopedFact } from "./fact-scope.ts";
import type { FactConflict } from "./fact-conflicts.ts";

/**
 * 文書全体で一つの値を持つ項目（試用期間、probation period）。語彙表の語の名前の値は、節をまたいで比べる。比べるのは、拠り所の値と
 * 文の値のあいだだけ: 拠り所（表の升か、見出しがその項目の名前の節「第2条（保証期間）」の値）がその項目に一通りの値を書き、別の所の
 * 文がそれと違う値を書いたとき、文の値を言う。
 * 名前に条件を書いた値（正社員の試用期間）は名前が語彙表の語と違うので比べない。表どうし、文どうしは、雇用形態ごとに並べた
 * 節のことがあるので比べない。拠り所が二通りの値を書いていれば、別々のものの値として言わない。
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

/** 同じ範囲で同じ名前の拠り所の値と違う文の値は、同じ範囲の食い違い（scopeConflicts）が言う。 */
const sameScopeAs = (fact: ScopedFact, sources: readonly ScopedFact[]): boolean => sources.some((cell) => cell.scope === fact.scope && cell.key === fact.key);

/** 項目の名前を見出しにした節の範囲と、その見出し。 */
export type TermHome = { readonly group: string; readonly heading: string; readonly start: number; readonly end: number };

/** section: 拠り所が表の升でなく、項目の名前を見出しにした節のときの、その見出し。 */
export type TermConflict = FactConflict & { readonly section?: string };

const homeOf = (fact: ScopedFact, homes: readonly TermHome[]): TermHome | undefined =>
  homes.find((home) => home.start <= fact.value.start && fact.value.start < home.end);

const isSource = (fact: ScopedFact, homes: readonly TermHome[]): boolean => fact.table === true || homeOf(fact, homes) !== undefined;

/** 拠り所に表の升があれば表、無ければ最初の拠り所の節の見出し。 */
const sectionOf = (sources: readonly ScopedFact[], homes: readonly TermHome[]): { section?: string } => {
  if (sources.some((fact) => fact.table === true)) return {};
  const heading = sources.map((fact) => homeOf(fact, homes)?.heading).find((written) => written !== undefined);
  return heading === undefined ? {} : { section: heading };
};

const conflictsInClass = (facts: readonly ScopedFact[], homes: readonly TermHome[]): TermConflict[] => {
  const sources = facts.filter((fact) => isSource(fact, homes));
  const [source, ...others] = distinctValues(sources.map((fact) => fact.value));
  if (source === undefined || others.length > 0) return [];
  if (distinctValues(facts.map((fact) => fact.value)).length !== MAX_DISTINCT) return [];
  const section = sectionOf(sources, homes);
  return facts
    .filter((fact) => !sources.includes(fact) && !sameValue(source, fact.value) && !sameScopeAs(fact, sources))
    .map((fact) => ({ fact, other: source, ...section }));
};

/** 名前の頭の冠詞（the）を落とした形。文の名前は落としてあるが、表の行の見出しは書いたまま。 */
const withoutDeterminer = (key: string, determiners: readonly string[]): string => {
  const [first, ...rest] = key.split(" ");
  return rest.length > 0 && determiners.some((word) => folded(word) === first) ? rest.join(" ") : key;
};

const groupOfKey = (written: string, words: TermWords): string | undefined => {
  const key = withoutDeterminer(written, words.determiners);
  return words.terms.find((word) => folded(word.pattern) === key)?.group;
};

const groupOf = (fact: ScopedFact, words: TermWords): string | undefined => groupOfKey(fact.key, words);

export type TermSection = { readonly heading: string; readonly start: number; readonly end: number };

/** 見出しが語彙表の項目の名前そのものの節（第2条（保証期間）、2. Warranty period）。 */
export const termHomes = (sections: readonly TermSection[], words: TermWords): TermHome[] =>
  sections.flatMap((section) => {
    const group = groupOfKey(folded(section.heading).trim(), words);
    return group === undefined ? [] : [{ group, heading: section.heading, start: section.start, end: section.end }];
  });

export type TermWords = { readonly terms: readonly TermWord[]; readonly determiners: readonly string[] };

/**
 * 語彙表の項目ごとに、拠り所の値と違う文の値。記録の欄（繰り返す名前）は比べない。冒頭や要約の値は、本文の値と summary-fact-mismatch
 * が比べるので、本文の値だけを読む。
 */
export const documentTermConflicts = (facts: readonly ScopedFact[], words: TermWords, homes: readonly TermHome[] = []): TermConflict[] => {
  const groups = new Map<string, ScopedFact[]>();
  facts.forEach((fact) => {
    const group = groupOf(fact, words);
    if (group === undefined || fact.record || fact.part !== "body") return;
    groups.set(group, [...(groups.get(group) ?? []), fact]);
  });
  return [...groups.entries()].flatMap(([group, members]) => {
    const own = homes.filter((home) => home.group === group);
    return comparableClasses(members).flatMap((comparableMembers) => conflictsInClass(comparableMembers, own));
  });
};
