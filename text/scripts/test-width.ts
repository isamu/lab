// How many test processes run at once. Several checkouts testing on one machine each take every core by default, so
// CHAFF_TEST_JOBS lets them share it.
import { availableParallelism } from "node:os";

/** CHAFF_TEST_JOBS when it is a positive whole number, else the number of cores. */
export const testWidth = (env: NodeJS.ProcessEnv = process.env, cores: number = availableParallelism()): number => {
  const asked = Number(env.CHAFF_TEST_JOBS);
  return Number.isInteger(asked) && asked > 0 ? asked : cores;
};
