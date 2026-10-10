// One contact written two ways: of two related writings, the one written fewer times, or the one first written later when
// both are written as often, is reported with the other. Pure: what a writing is and which writings are related come from
// the caller (an email address, a postal address).

/** A contact as written and where. key is what makes two writings the same contact. */
export type Writing = { readonly offset: number; readonly written: string; readonly key: string };

/** A writing that is a variant of another contact's writing, and that other writing. */
export type Variant<T extends Writing> = { readonly writing: T; readonly other: T };

const byKey = <T extends Writing>(writings: readonly T[]): Map<string, T[]> =>
  writings.reduce((groups, writing) => groups.set(writing.key, [...(groups.get(writing.key) ?? []), writing]), new Map<string, T[]>());

/** Every writing of the minority side of each related pair, with the first writing of the other side, in document order. */
export const writingVariants = <T extends Writing>(writings: readonly T[], related: (a: T, b: T) => boolean): Variant<T>[] => {
  const groups = byKey(writings);
  const timesOf = (writing: T): number => groups.get(writing.key)?.length ?? 0;
  const firsts = [...groups.values()].flatMap((group) => group.slice(0, 1));
  const minorityOf = (a: T, b: T): T => {
    if (timesOf(a) !== timesOf(b)) return timesOf(a) < timesOf(b) ? a : b;
    return a.offset > b.offset ? a : b;
  };
  return firsts
    .flatMap((first, index) =>
      firsts.slice(index + 1).flatMap((second) => {
        if (!related(first, second)) return [];
        const minority = minorityOf(first, second);
        const other = minority === first ? second : first;
        return (groups.get(minority.key) ?? []).map((writing) => ({ writing, other }));
      }),
    )
    .toSorted((a, b) => a.writing.offset - b.writing.offset);
};
