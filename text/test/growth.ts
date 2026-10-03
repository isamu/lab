import assert from "node:assert/strict";

/** The large run reads this many times the input of the small one. */
const GROWTH = 4;
/** A linear run takes about GROWTH times as long, a quadratic one about GROWTH²; this sits halfway between them. */
const LINEAR_BOUND = GROWTH * 2;
const ATTEMPTS = 3;
/** Each attempt compares the median of this many samples of each size, so one sample a GC or the scheduler slowed moves nothing. */
const SAMPLES = 5;
/**
 * A sample repeats the run until it has used this much CPU time. Windows counts CPU time in steps of about 16 ms, so a
 * single small run there measures 0 ms; a sample this long is several steps.
 */
const MIN_SAMPLE_MS = 100;
/** The smallest time per run a sample is taken to be, so a run too fast to measure never divides by zero. */
const FLOOR_MS = 0.001;
const MICROSECONDS_PER_MS = 1000;

/** CPU time, not wall time: on a loaded machine the wall clock also counts the time other processes held the CPU. */
const cpuMs = (since: NodeJS.CpuUsage): number => {
  const used = process.cpuUsage(since);
  return (used.user + used.system) / MICROSECONDS_PER_MS;
};

/** The CPU time of one run, from repeating it until the clock has measured at least MIN_SAMPLE_MS. */
const sampleMs = (run: () => void): number => {
  const started = process.cpuUsage();
  const counted = { runs: 0, ms: 0 };
  while (counted.ms < MIN_SAMPLE_MS) {
    run();
    counted.runs += 1;
    counted.ms = cpuMs(started);
  }
  return Math.max(counted.ms / counted.runs, FLOOR_MS);
};

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? FLOOR_MS;
};

/** The ratio of the median times of the large and the small run, their samples taken in turn. */
const growthRatio = (run: (size: number) => void, size: number): number => {
  const samples = Array.from({ length: SAMPLES }, () => ({ small: sampleMs(() => run(size)), large: sampleMs(() => run(size * GROWTH)) }));
  return median(samples.map((sample) => sample.large)) / median(samples.map((sample) => sample.small));
};

/**
 * Asserts that `run(size * GROWTH)` takes less than LINEAR_BOUND times as long as `run(size)`. A time limit fails on a
 * loaded machine; a ratio of the CPU time of two runs does not. Each attempt compares medians of repeated samples,
 * after one warm-up run, and one attempt under the bound is enough.
 */
export const assertLinearGrowth = (run: (size: number) => void, size: number): void => {
  run(size);
  const ratios: number[] = [];
  const linear = Array.from({ length: ATTEMPTS }).some(() => {
    const ratio = growthRatio(run, size);
    ratios.push(ratio);
    return ratio < LINEAR_BOUND;
  });
  const shown = ratios.map((ratio) => ratio.toFixed(1)).join(", ");
  assert.ok(linear, `${String(GROWTH)}x the input took ${shown}x as long (linear is about ${String(GROWTH)}x)`);
};
