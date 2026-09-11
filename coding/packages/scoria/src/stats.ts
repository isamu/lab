/** Distribution summaries. The mean is avoided because many small files hide the huge ones (spec §13.1). */

const ascending = (values: readonly number[]): readonly number[] => [...values].sort((a, b) => a - b);

/** Nearest-rank. `q` is 0..1. */
export const percentile = (values: readonly number[], q: number): number => {
  if (values.length === 0) return 0;
  const sorted = ascending(values);
  const rank = Math.ceil(q * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? 0;
};

export const maximum = (values: readonly number[]): number => values.reduce((a, b) => Math.max(a, b), 0);

export const total = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** Per-kloc that keeps the zero check out of every call site. Returns 0 when sloc is 0. */
export const perKiloLines = (count: number, sloc: number): number => (sloc === 0 ? 0 : Number(((count * 1000) / sloc).toFixed(4)));
