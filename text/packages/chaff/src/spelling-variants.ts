// One word written two ways in one document, found without a hand list: the words come in already keyed (two spellings of one
// word share a key), and this picks, per key, the spellings the document uses less. Pure: no document, no language here.

/** A word as written: the key that says which word it is, and how this place spells it. */
export type KeyedWord = { readonly key: string; readonly spelling: string };

/** A word spelled the way the document uses less: the spelling it usually uses, and how many of the word's places differ. */
export type OddSpelling<T extends KeyedWord> = { readonly word: T; readonly usual: string; readonly count: number; readonly of: number };

const PERCENT = 100;

/** Items by key, in the order each key first appears. */
export const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> =>
  items.reduce((groups, item) => {
    // Pushed in place: copying the group for each item is quadratic in a long document's commonest word.
    const group = groups.get(keyOf(item));
    if (group === undefined) groups.set(keyOf(item), [item]);
    else group.push(item);
    return groups;
  }, new Map<string, T[]>());

const groupsOf = <T extends KeyedWord>(words: readonly T[]): T[][] => [...groupBy(words, (word) => word.key).values()];

/** Spellings by how often the group writes them, most first; ties keep the order they were first written in. */
const spellingsByUse = (group: readonly KeyedWord[]): [string, number][] =>
  [...groupBy(group, (word) => word.spelling).entries()].map(([spelling, uses]): [string, number] => [spelling, uses.length]).toSorted((a, b) => b[1] - a[1]);

/**
 * The places in one group that do not use its most common spelling. Nothing when the group has one spelling, when two spellings
 * tie for the most (no side to take), or when the others are more than limitPercent of the group (the document uses both on purpose).
 */
const oddIn = <T extends KeyedWord>(group: readonly T[], limitPercent: number): OddSpelling<T>[] => {
  const [first, second] = spellingsByUse(group);
  if (first === undefined || second === undefined || first[1] === second[1]) return [];
  const odd = group.filter((word) => word.spelling !== first[0]);
  if (odd.length * PERCENT > limitPercent * group.length) return [];
  return odd.map((word) => ({ word, usual: first[0], count: odd.length, of: group.length }));
};

/** Every place spelled the way its document uses less, key by key. */
export const oddSpellings = <T extends KeyedWord>(words: readonly T[], limitPercent: number): OddSpelling<T>[] =>
  groupsOf(words).flatMap((group) => oddIn(group, limitPercent));
