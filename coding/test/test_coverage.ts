import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { coverage } from "../packages/scoria/src/probes/coverage.ts";
import { contextWith, sourceFile } from "./helpers.ts";

const files = [sourceFile("src/a.ts", ["export const a = 1;"])];

const repoWith = async (entries: Readonly<Record<string, string>>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "scoria-coverage-"));
  for (const [path, text] of Object.entries(entries)) {
    await mkdir(join(root, dirname(path)), { recursive: true });
    await writeFile(join(root, path), text, "utf8");
  }
  return root;
};

/** The probe resolves its own paths against the root, so this only has to read absolute ones. */
const readText = async (path: string): Promise<string | undefined> => readFile(path, "utf8").catch(() => undefined);

const metricsOf = async (root: string): Promise<Readonly<Record<string, number>>> => {
  const result = await coverage.run(contextWith(files, { root, readText }));
  return Object.fromEntries(result.metrics.map((metric) => [metric.id, metric.value]));
};

const SUMMARY = JSON.stringify({
  total: {
    lines: { pct: 82 },
    branches: { pct: 65 },
    functions: { pct: 75 },
  },
});

/** Istanbul's `json-summary`, which Vitest, Jest and nyc can all be asked for. */
test("a json-summary report is read as percentages", async () => {
  const metrics = await metricsOf(await repoWith({ "coverage/coverage-summary.json": SUMMARY }));
  assert.equal(metrics["coverage.line_pct"], 82);
  assert.equal(metrics["coverage.branch_pct"], 65);
  assert.equal(metrics["coverage.function_pct"], 75);
});

/**
 * lcov carries counts, not percentages, once per file. Node's own test runner writes this with
 * `--test-reporter=lcov`, and most coverage tools emit it without being asked.
 */
const LCOV = `TN:
SF:src/a.ts
LF:100
LH:75
FNF:10
FNH:8
BRF:20
BRH:10
end_of_record
TN:
SF:src/b.ts
LF:100
LH:95
FNF:10
FNH:10
BRF:0
BRH:0
end_of_record
`;

test("an lcov report is summed across files and turned into percentages", async () => {
  const metrics = await metricsOf(await repoWith({ "coverage/lcov.info": LCOV }));
  assert.equal(metrics["coverage.line_pct"], 85);
  assert.equal(metrics["coverage.function_pct"], 90);
  assert.equal(metrics["coverage.branch_pct"], 50);
});

/** A file with no branches contributes nothing, rather than a hundred per cent of nothing. */
test("a file without branches does not inflate branch coverage", async () => {
  const noBranches = "TN:\nSF:src/a.ts\nLF:10\nLH:10\nFNF:1\nFNH:1\nBRF:0\nBRH:0\nend_of_record\n";
  const metrics = await metricsOf(await repoWith({ "coverage/lcov.info": noBranches }));
  assert.equal(metrics["coverage.branch_pct"], 0);
  assert.equal(metrics["coverage.line_pct"], 100);
});

test("json-summary wins where both are present", async () => {
  const metrics = await metricsOf(await repoWith({ "coverage/coverage-summary.json": SUMMARY, "coverage/lcov.info": LCOV }));
  assert.equal(metrics["coverage.line_pct"], 82);
});

test("an lcov file with no line records is not a report", async () => {
  const result = await coverage.run(contextWith(files, { root: await repoWith({ "coverage/lcov.info": "TN:\nend_of_record\n" }), readText }));
  assert.equal(result.status.kind, "skipped");
});

/** scoria does not run the tests, so no report is a normal state and not a failure. */
test("no report at all is skipped, not zero", async () => {
  const root = await repoWith({ "package.json": "{}" });
  const result = await coverage.run(contextWith(files, { root, readText }));
  assert.equal(result.status.kind, "skipped");
  assert.deepEqual(result.metrics, []);
});
