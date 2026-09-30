/** A stretch of a sentence's tokens, [start, end). */
export type TokenRange = { readonly start: number; readonly end: number };

/**
 * Tokens set aside (a list's commas, which an item holds or not by their depth) with a key each. A question leaves out
 * the ones with one key and counts the rest.
 */
type Aside = {
  /** Indices of the passing tokens set aside, in order. */
  readonly at: readonly number[];
  readonly keys: readonly number[];
  /** Per key, the positions in `at` that have it. */
  readonly byKey: ReadonlyMap<number, readonly number[]>;
  /** For each position in `at`, the next and previous position whose key differs, or at.length / -1. */
  readonly nextOther: readonly number[];
  readonly previousOther: readonly number[];
};

/**
 * One test over a sentence, read once: how many tokens before each index pass it, and the nearest passing index at or
 * after, and before, each index. A range then answers "how many", "the first" and "the last" without reading it.
 * Tokens set aside are not in these counts; the ones that pass are in `aside`.
 */
export type Column = {
  readonly before: readonly number[];
  readonly next: readonly number[];
  readonly previous: readonly number[];
  readonly aside: Aside;
};

/** The key of a token set aside, or undefined for an ordinary token. */
export type AsideKey<T> = (item: T, index: number) => number | undefined;

/** The first index in a sorted list at which the value is at least `value`. */
export const lowerBound = (sorted: readonly number[], value: number): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return low;
    const middle = Math.floor((low + high) / 2);
    return (sorted[middle] ?? value) < value ? search(middle + 1, high) : search(low, middle);
  };
  return search(0, sorted.length);
};

const prefixCounts = (passes: readonly boolean[]): number[] =>
  passes.reduce<number[]>(
    (counts, passed, index) => {
      counts.push((counts[index] ?? 0) + (passed ? 1 : 0));
      return counts;
    },
    [0],
  );

const nextPassing = (passes: readonly boolean[]): number[] =>
  passes.reduceRight<number[]>(
    (found, passed, index) => {
      found[index] = passed ? index : (found[index + 1] ?? passes.length);
      return found;
    },
    Array.from({ length: passes.length + 1 }, () => passes.length),
  );

const previousPassing = (passes: readonly boolean[]): number[] =>
  passes.reduce<number[]>(
    (found, passed, index) => {
      found.push(passed ? index : (found[index] ?? -1));
      return found;
    },
    [-1],
  );

const asideOf = (at: readonly number[], keys: readonly number[]): Aside => {
  const byKey = keys.reduce((found, key, position) => {
    const list = found.get(key);
    if (list === undefined) found.set(key, [position]);
    else list.push(position);
    return found;
  }, new Map<number, number[]>());
  const nextOther = keys.reduceRight<number[]>((found, key, position) => {
    found[position] = keys[position + 1] !== key ? position + 1 : (found[position + 1] ?? keys.length);
    return found;
  }, []);
  const previousOther = keys.reduce<number[]>((found, key, position) => {
    found.push(position === 0 || keys[position - 1] !== key ? position - 1 : (found[position - 1] ?? -1));
    return found;
  }, []);
  return { at, keys, byKey, nextOther, previousOther };
};

export const columnOf = <T>(items: readonly T[], test: (item: T, index: number) => boolean, asideKey: AsideKey<T> = () => undefined): Column => {
  const keys = items.map(asideKey);
  const tested = items.map(test);
  const passes = tested.map((passed, index) => passed && keys[index] === undefined);
  const asideAt = tested.flatMap((passed, index) => (passed && keys[index] !== undefined ? [index] : []));
  return {
    before: prefixCounts(passes),
    next: nextPassing(passes),
    previous: previousPassing(passes),
    aside: asideOf(
      asideAt,
      asideAt.map((index) => keys[index] ?? 0),
    ),
  };
};

/** Positions in `aside.at` of the tokens set aside within the range, [low, high). */
const asideSpan = (aside: Aside, range: TokenRange): { readonly low: number; readonly high: number } => ({
  low: lowerBound(aside.at, range.start),
  high: lowerBound(aside.at, range.end),
});

const asideCount = (aside: Aside, range: TokenRange, excluded: number | undefined): number => {
  if (excluded === undefined || aside.at.length === 0) return 0;
  const { low, high } = asideSpan(aside, range);
  const same = aside.byKey.get(excluded) ?? [];
  return high - low - (lowerBound(same, high) - lowerBound(same, low));
};

const firstAside = (aside: Aside, range: TokenRange, excluded: number | undefined): number => {
  if (excluded === undefined || aside.at.length === 0) return range.end;
  const { low, high } = asideSpan(aside, range);
  const position = aside.keys[low] === excluded ? (aside.nextOther[low] ?? high) : low;
  return position < high ? (aside.at[position] ?? range.end) : range.end;
};

const lastAside = (aside: Aside, range: TokenRange, excluded: number | undefined): number => {
  if (excluded === undefined || aside.at.length === 0) return -1;
  const { low, high } = asideSpan(aside, range);
  const position = aside.keys[high - 1] === excluded ? (aside.previousOther[high - 1] ?? -1) : high - 1;
  return position >= low ? (aside.at[position] ?? -1) : -1;
};

/**
 * How many tokens in the range pass. `excluded` is the key of the tokens set aside that do not count; without it, none of
 * them count.
 */
export const countIn = (column: Column, range: TokenRange, excluded?: number): number =>
  (column.before[range.end] ?? 0) - (column.before[range.start] ?? 0) + asideCount(column.aside, range, excluded);

/** The first passing index in the range, or -1. */
export const firstIn = (column: Column, range: TokenRange, excluded?: number): number => {
  const first = Math.min(column.next[range.start] ?? range.end, firstAside(column.aside, range, excluded));
  return first < range.end ? first : -1;
};

/** The last passing index in the range, or -1. */
export const lastIn = (column: Column, range: TokenRange, excluded?: number): number => {
  const last = Math.max(column.previous[range.end] ?? -1, lastAside(column.aside, range, excluded));
  return last >= range.start ? last : -1;
};
