/** Code-unit order, the same on every machine: a hash or a result must not depend on the locale it was made in. */
export const compareText = (left: string, right: string): number => (left < right ? -1 : Number(left > right));

/** An object whose keys are in compareText order. */
export const sortedByKey = <T>(entries: readonly (readonly [string, T])[]): Record<string, T> =>
  Object.fromEntries(entries.toSorted(([left], [right]) => compareText(left, right)));

/** How many times each value occurs, by value in compareText order. */
export const tally = (values: readonly string[]): Record<string, number> =>
  sortedByKey(Object.entries(values.reduce<Record<string, number>>((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {})));
