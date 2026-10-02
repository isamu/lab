import assert from "node:assert/strict";

/** The large run reads this many times the input of the small one. */
const GROWTH = 4;
/** A linear run takes about GROWTH times as long, a quadratic one about GROWTH²; this sits halfway between them. */
const LINEAR_BOUND = GROWTH * 2;
const ATTEMPTS = 3;
const MICROSECONDS_PER_MS = 1000;

/** CPU time, not wall time: on a loaded machine the wall clock also counts the time other processes held the CPU. */
const elapsedMs = (run: () => void): number => {
  const started = process.cpuUsage();
  run();
  const used = process.cpuUsage(started);
  return (used.user + used.system) / MICROSECONDS_PER_MS;
};

/**
 * Asserts that `run(size * GROWTH)` takes less than LINEAR_BOUND times as long as `run(size)`. A time limit fails on a
 * loaded machine; a ratio of the CPU time of two runs does not. Each attempt times a small and a large run back to
 * back, after one warm-up run, and one attempt under the bound is enough.
 */
export const assertLinearGrowth = (run: (size: number) => void, size: number): void => {
  run(size);
  const ratios: number[] = [];
  const linear = Array.from({ length: ATTEMPTS }).some(() => {
    const smallMs = elapsedMs(() => run(size));
    const ratio = elapsedMs(() => run(size * GROWTH)) / smallMs;
    ratios.push(ratio);
    return ratio < LINEAR_BOUND;
  });
  const shown = ratios.map((ratio) => ratio.toFixed(1)).join(", ");
  assert.ok(linear, `${String(GROWTH)}x the input took ${shown}x as long (linear is about ${String(GROWTH)}x)`);
};
