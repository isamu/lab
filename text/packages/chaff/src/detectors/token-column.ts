/** A stretch of a sentence's tokens, [start, end). */
export type TokenRange = { readonly start: number; readonly end: number };

/**
 * One test over a sentence, read once: how many tokens before each index pass it, and the nearest passing index at or
 * after, and before, each index. A range then answers "how many", "the first" and "the last" without reading it.
 * Tokens set aside (a list's commas, which an item may or may not hold) are not in these counts; the ones that pass are
 * listed in `aside`, and each question says which of them count.
 */
export type Column = {
  readonly before: readonly number[];
  readonly next: readonly number[];
  readonly previous: readonly number[];
  readonly aside: readonly number[];
};

export const columnOf = <T>(items: readonly T[], test: (item: T, index: number) => boolean, setAside: (item: T) => boolean = () => false): Column => {
  const passes = items.map((item, index) => test(item, index) && !setAside(item));
  const before = passes.reduce<number[]>(
    (counts, passed, index) => {
      counts.push((counts[index] ?? 0) + (passed ? 1 : 0));
      return counts;
    },
    [0],
  );
  const next = passes.reduceRight<number[]>(
    (found, passed, index) => {
      found[index] = passed ? index : (found[index + 1] ?? items.length);
      return found;
    },
    Array.from({ length: items.length + 1 }, () => items.length),
  );
  const previous = passes.reduce<number[]>(
    (found, passed, index) => {
      found.push(passed ? index : (found[index] ?? -1));
      return found;
    },
    [-1],
  );
  const aside = items.flatMap((item, index) => (setAside(item) && test(item, index) ? [index] : []));
  return { before, next, previous, aside };
};

/** Which of the passing tokens set aside count in a question. */
export type Admit = (index: number) => boolean;

const admitNone: Admit = () => false;

/** The first index in a sorted list at which the value is at least `value`. */
export const lowerBound = (sorted: readonly number[], value: number): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return low;
    const middle = Math.floor((low + high) / 2);
    return (sorted[middle] ?? value) < value ? search(middle + 1, high) : search(low, middle);
  };
  return search(0, sorted.length);
};

/** The passing tokens set aside in the range that count. Tokens set aside are rare, so this reads them one by one. */
const admittedAside = (column: Column, range: TokenRange, admit: Admit): number[] =>
  column.aside.length === 0 ? [] : column.aside.slice(lowerBound(column.aside, range.start), lowerBound(column.aside, range.end)).filter(admit);

export const countIn = (column: Column, range: TokenRange, admit: Admit = admitNone): number =>
  (column.before[range.end] ?? 0) - (column.before[range.start] ?? 0) + admittedAside(column, range, admit).length;

/** The first passing index in the range, or -1. */
export const firstIn = (column: Column, range: TokenRange, admit: Admit = admitNone): number => {
  const found = column.next[range.start] ?? range.end;
  const aside = admittedAside(column, range, admit)[0] ?? range.end;
  const first = Math.min(found, aside);
  return first < range.end ? first : -1;
};

/** The last passing index in the range, or -1. */
export const lastIn = (column: Column, range: TokenRange, admit: Admit = admitNone): number => {
  const found = column.previous[range.end] ?? -1;
  const aside = admittedAside(column, range, admit).at(-1) ?? -1;
  const last = Math.max(found, aside);
  return last >= range.start ? last : -1;
};
