/** The keys of the densest stretch, and the index of its first item. */
export type Stretch<K> = { readonly keys: ReadonlySet<K>; readonly first: number };

const keysIn = <K>(hitsPerItem: readonly (readonly K[])[], start: number, window: number): Set<K> => new Set(hitsPerItem.slice(start, start + window).flat());

const scoreOf = <K>(keys: ReadonlySet<K>, weightOf: (key: K) => number): number => [...keys].reduce((sum, key) => sum + weightOf(key), 0);

/**
 * The run of at most `window` consecutive items whose distinct keys weigh the most, starting at an item with a key.
 * The earliest wins a tie. When every hit fits in one window, that is all of them, from the first hit.
 */
export const densestStretch = <K>(hitsPerItem: readonly (readonly K[])[], window: number, weightOf: (key: K) => number): Stretch<K> | undefined =>
  hitsPerItem.reduce<{ best: Stretch<K> | undefined; score: number }>(
    (acc, hits, start) => {
      if (hits.length === 0) return acc;
      const keys = keysIn(hitsPerItem, start, window);
      const score = scoreOf(keys, weightOf);
      return acc.best !== undefined && score <= acc.score ? acc : { best: { keys, first: start }, score };
    },
    { best: undefined, score: -Infinity },
  ).best;
