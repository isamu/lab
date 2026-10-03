// Runs a list of jobs in several node processes at once. The command line runs in the working directory, which is the
// process's, so one process can run only one command line at a time; separate processes run them side by side.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deal, undeal } from "./deal.ts";
import { testWidth } from "./test-width.ts";

const WORKER = join(import.meta.dirname, "child-worker.ts");

const isList = (value: unknown): value is unknown[] => Array.isArray(value);

/** Under node --test this names the runner's channel; a worker that kept it would report to the runner as a test file. */
const workerEnv = (): NodeJS.ProcessEnv => Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "NODE_TEST_CONTEXT"));

/** One worker process over its hand of jobs; its stderr is kept for the error. */
const runWorker = async (args: readonly string[], where: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER, ...args], { stdio: ["ignore", "ignore", "pipe"], env: workerEnv() });
    const stderr: string[] = [];
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => stderr.push(chunk));
    child.on("error", (error) => reject(new Error(`${where}: could not start ${WORKER}`, { cause: error })));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${where}: worker exited with ${String(code)}\n${stderr.join("")}`))));
  });

const runHand = async (dir: string, moduleUrl: string, exportName: string, hand: readonly unknown[], index: number): Promise<unknown[]> => {
  const where = `in-children: ${exportName} of ${moduleUrl}, hand ${index + 1}`;
  const input = join(dir, `${index}.in.json`);
  const output = join(dir, `${index}.out.json`);
  writeFileSync(input, JSON.stringify(hand), "utf8");
  await runWorker([moduleUrl, exportName, input, output], where);
  const results: unknown = JSON.parse(readFileSync(output, "utf8"));
  if (!isList(results) || results.length !== hand.length) throw new Error(`${where}: ${output} does not hold one result per job`);
  return results;
};

/**
 * exportName of moduleUrl, called with a hand of the jobs in each of up to `width` processes, which returns one result
 * per job. The results come back in the jobs' order. Jobs and results go through JSON.
 */
export const mapInChildren = async (moduleUrl: string, exportName: string, jobs: readonly unknown[], width = testWidth()): Promise<unknown[]> => {
  if (jobs.length === 0) return [];
  const dir = mkdtempSync(join(tmpdir(), "chaff-children-"));
  try {
    const hands = deal(jobs, width);
    return undeal(await Promise.all(hands.map((hand, index) => runHand(dir, moduleUrl, exportName, hand, index))), jobs.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
