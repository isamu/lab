// yarn test:times <log file>... [--job <job name prefix>]: rewrites scripts/test-times.json from CI logs, in which the test
// jobs print each file's time (scripts/test-times-reporter.ts). The Windows parts are the slowest, so take their times:
//   gh run view <run id> -R isamu/lab --log > run.log && yarn test:times run.log --job "test (windows-latest"
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { timesFromLogs, timesTable } from "./test-times.ts";

const TABLE = join(import.meta.dirname, "test-times.json");

const readLog = (path: string): string => {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`test:times: cannot read ${path}`, { cause: error });
  }
};

const args = process.argv.slice(2);
const jobAt = args.indexOf("--job");
const job = jobAt === -1 ? undefined : args[jobAt + 1];
const paths = args.filter((_, index) => jobAt === -1 || (index !== jobAt && index !== jobAt + 1));
if (paths.length === 0) throw new Error("test:times: give the CI log files to read");
const times = timesFromLogs(paths.map(readLog), job);
const forJob = job === undefined ? "" : ` for the job ${job}`;
if (times.size === 0) throw new Error(`test:times: no file times in ${paths.join(", ")}${forJob}`);
writeFileSync(TABLE, timesTable(times));
console.log(`test:times: ${times.size} files written to scripts/test-times.json`);
