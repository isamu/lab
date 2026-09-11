import { test } from "node:test";
import assert from "node:assert/strict";
import { oxlint } from "../packages/scoria/src/probes/oxlint.ts";
import { tsc } from "../packages/scoria/src/probes/tsc.ts";
import { knip } from "../packages/scoria/src/probes/knip.ts";
import { jscpd } from "../packages/scoria/src/probes/jscpd.ts";
import { contextWith, execReturning, sourceFile } from "./helpers.ts";

const files = [sourceFile("src/a.ts", ["export const a = 1;", "export const b = 2;"])];

const metricOf = (metrics: readonly { id: string; value: number }[], id: string): number => metrics.find((m) => m.id === id)?.value ?? -1;

const OXLINT_JSON = JSON.stringify({
  diagnostics: [
    {
      code: "eslint(no-await-in-loop)",
      filename: "/repo/src/a.ts",
      message: "Unexpected `await` inside a loop.",
      severity: "error",
      labels: [{ line: 12 }],
    },
    {
      code: "unicorn(no-array-sort)",
      filename: "/repo/src/b.ts",
      message: "Use `Array#toSorted()`.",
      severity: "warning",
      labels: [{ line: 3 }],
    },
  ],
});

test("oxlint reports violations with the plugin prefix stripped from the rule", async () => {
  const result = await oxlint.run(contextWith(files, { root: "/repo", exec: execReturning(OXLINT_JSON, 1) }));
  assert.equal(metricOf(result.metrics, "oxlint.violations"), 2);
  assert.deepEqual(
    result.findings.map((f) => f.rule),
    ["oxlint/no-await-in-loop", "oxlint/no-array-sort"],
  );
});

/** A file path is only useful relative to the repository being measured. */
test("oxlint reports paths relative to the target", async () => {
  const result = await oxlint.run(contextWith(files, { root: "/repo", exec: execReturning(OXLINT_JSON, 1) }));
  assert.equal(result.findings[0]?.file, "src/a.ts");
  assert.equal(result.findings[0]?.line, 12);
});

test("oxlint separates denied errors from warned smells", async () => {
  const result = await oxlint.run(contextWith(files, { root: "/repo", exec: execReturning(OXLINT_JSON, 1) }));
  assert.ok(metricOf(result.metrics, "oxlint.errors_per_kloc") < metricOf(result.metrics, "oxlint.violations_per_kloc"));
});

const TSC_OUTPUT = ["src/a.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.", "Found 1 error in src/a.ts"].join("\n");

test("tsc parses file, line, code and message out of its plain output", async () => {
  const result = await tsc.run(contextWith(files, { exec: execReturning(TSC_OUTPUT, 2) }));
  assert.equal(metricOf(result.metrics, "tsc.type_errors"), 1);
  assert.equal(result.findings[0]?.file, "src/a.ts");
  assert.equal(result.findings[0]?.line, 12);
  assert.equal(result.findings[0]?.rule, "tsc/TS2322");
});

test("tsc is skipped where the project has no tsconfig", async () => {
  const status = await tsc.detect(contextWith(files));
  assert.equal(status.kind, "skipped");
});

/** Without node_modules knip resolves nothing and reports nothing, which reads as clean. */
test("knip is skipped where the project is not installed", async () => {
  const status = await knip.detect(contextWith(files, { project: { typescript: true, installed: false, stacks: ["ts"] } }));
  assert.equal(status.kind, "skipped");
  assert.match("reason" in status ? status.reason : "", /not installed/);
});

test("knip counts unused files, exports and dependencies", async () => {
  const report = JSON.stringify([{ file: "src/dead.ts", exports: [{ name: "unusedThing" }], dependencies: ["left-pad"] }, { files: ["src/orphan.ts"] }]);
  const result = await knip.run(contextWith(files, { exec: execReturning(report) }));
  assert.equal(metricOf(result.metrics, "knip.unused_exports"), 1);
  assert.equal(metricOf(result.metrics, "knip.unused_files"), 1);
  assert.equal(metricOf(result.metrics, "knip.unused_dependencies"), 1);
});

/** jscpd writes no report when it finds nothing. That is zero duplication, not a failed run. */
test("jscpd reports zero duplication rather than failing when there are no clones", async () => {
  const result = await jscpd.run(contextWith(files, { exec: execReturning("", 0) }));
  assert.equal(result.status.kind, "ok");
  assert.equal(metricOf(result.metrics, "jscpd.duplicated_lines_pct"), 0);
});

test("jscpd reads the percentage and clones out of its report", async () => {
  const report = JSON.stringify({
    statistics: { total: { percentage: 2.13 } },
    duplicates: [{ firstFile: { name: "/repo/src/a.ts", start: 4 }, lines: 20 }],
  });
  const result = await jscpd.run(contextWith(files, { root: "/repo", exec: execReturning("", 0), readText: () => Promise.resolve(report) }));
  assert.equal(metricOf(result.metrics, "jscpd.duplicated_lines_pct"), 2.13);
  assert.equal(result.findings[0]?.file, "src/a.ts");
});

/**
 * `.scoria/baseline.json` is a record of the previous run. Counting it means recording a baseline
 * changes the next measurement, and a tool that perturbs what it measures has no time series.
 */
test("jscpd is told to ignore scoria's own artifacts and non-code formats", async () => {
  const seen: string[][] = [];
  const exec = (_command: string, args: readonly string[]): Promise<{ stdout: string; stderr: string; code: number }> => {
    seen.push([...args]);
    return Promise.resolve({ stdout: "", stderr: "", code: 0 });
  };
  await jscpd.run(contextWith(files, { exec }));
  const args = seen[0] ?? [];
  const ignored = args[args.indexOf("--ignore") + 1] ?? "";
  assert.match(ignored, /\.scoria/);
  assert.match(ignored, /node_modules/);
  const formats = args[args.indexOf("--format") + 1] ?? "";
  assert.doesNotMatch(formats, /json|markdown/);
  assert.match(formats, /typescript/);
});
