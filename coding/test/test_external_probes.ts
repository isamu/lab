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
  const status = await knip.detect(contextWith(files, { project: { typescript: true, installed: false, packageManager: "yarn", stacks: ["ts"] } }));
  assert.equal(status.kind, "skipped");
  assert.match("reason" in status ? status.reason : "", /not installed/);
});

test("knip counts unused files, exports and dependencies", async () => {
  const report = JSON.stringify([{ file: "src/dead.ts", exports: [{ name: "unusedThing" }], dependencies: ["left-pad"] }, { files: ["src/orphan.ts"] }]);
  const scope = [sourceFile("src/dead.ts", ["export const unusedThing = 1;"]), sourceFile("src/orphan.ts", ["export const orphan = 1;"])];
  const result = await knip.run(contextWith(scope, { exec: execReturning(report) }));
  assert.equal(metricOf(result.metrics, "knip.unused_exports"), 1);
  assert.equal(metricOf(result.metrics, "knip.unused_files"), 1);
  assert.equal(metricOf(result.metrics, "knip.unused_dependencies"), 1);
});

/**
 * knip's own output, which is what it actually emits: `files` entries are `{ name }`, not strings.
 * The fixture above was written from an assumption and passed while the parser read no file at all
 * — `unused_files` was zero across every one of the 49 repositories measured for calibration.
 */
/**
 * Run without a config on a monorepo, knip walks generated output and calls it unused: 573 files
 * in graphai against the 450 scoria classifies as source at all.
 */
/**
 * A count against a fixed anchor scores a large repository worse for being large
 * (docs/calibration.md), so the rubric weighs shares of the file count. The counts stay reported.
 */
test("knip reports unused files and exports as shares of the repository", async () => {
  const report = JSON.stringify({
    issues: [
      { file: "a.ts", files: [{ name: "src/dead.ts" }], exports: [], dependencies: [] },
      { file: "src/live.ts", files: [], exports: [{ name: "gone" }], dependencies: [] },
    ],
  });
  const scope = [sourceFile("src/dead.ts", ["export const a = 1;"]), sourceFile("src/live.ts", ["export const gone = 1;"])];
  const result = await knip.run(contextWith(scope, { exec: execReturning(report) }));
  assert.equal(metricOf(result.metrics, "knip.unused_files"), 1);
  assert.equal(metricOf(result.metrics, "knip.unused_file_ratio"), 0.5);
  assert.equal(metricOf(result.metrics, "knip.unused_export_ratio"), 0.5);
});

test("knip findings outside scoria's own file set do not count", async () => {
  const report = JSON.stringify({
    issues: [
      { file: "a.ts", files: [{ name: "src/a.ts" }], exports: [], dependencies: [] },
      { file: "b.ts", files: [{ name: "docs/apiDoc/assets/main.js" }], exports: [], dependencies: [] },
      { file: "docs/apiDoc/assets/search.js", files: [], exports: [{ name: "gone" }], dependencies: [] },
    ],
  });
  const result = await knip.run(contextWith([sourceFile("src/a.ts", ["export const a = 1;"])], { exec: execReturning(report) }));
  assert.equal(metricOf(result.metrics, "knip.unused_files"), 1);
  assert.equal(metricOf(result.metrics, "knip.unused_exports"), 0);
});

test("knip's real output shape wraps each unused file in an object", async () => {
  const report = JSON.stringify({
    issues: [
      { file: "a.ts", files: [{ name: "src/orphan.ts" }], exports: [], dependencies: [] },
      { file: "b.ts", files: [{ name: "src/stray.ts" }], exports: [], dependencies: [] },
    ],
  });
  const scope = [sourceFile("src/orphan.ts", ["export const a = 1;"]), sourceFile("src/stray.ts", ["export const b = 2;"])];
  const result = await knip.run(contextWith(scope, { exec: execReturning(report) }));
  assert.equal(metricOf(result.metrics, "knip.unused_files"), 2);
  assert.deepEqual(
    result.findings.filter((finding) => finding.rule === "unused-file").map((finding) => finding.file),
    ["src/orphan.ts", "src/stray.ts"],
  );
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

test("audit reads yarn's line-delimited summary", async () => {
  const { audit } = await import("../packages/scoria/src/probes/audit.ts");
  const output = [
    JSON.stringify({ type: "auditAdvisory", data: {} }),
    JSON.stringify({ type: "auditSummary", data: { vulnerabilities: { critical: 1, high: 3, moderate: 6, low: 0 } } }),
  ].join("\n");
  const result = await audit.run(contextWith(files, { exec: execReturning(output, 1) }));
  assert.equal(metricOf(result.metrics, "audit.critical"), 1);
  assert.equal(metricOf(result.metrics, "audit.high"), 3);
  assert.equal(metricOf(result.metrics, "audit.moderate"), 6);
});

test("audit reads npm's single object", async () => {
  const { audit } = await import("../packages/scoria/src/probes/audit.ts");
  const output = JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 2, moderate: 0, low: 4 } } });
  const project = { typescript: true, installed: true, packageManager: "npm" as const, stacks: ["ts"] };
  const result = await audit.run(contextWith(files, { exec: execReturning(output, 1), project }));
  assert.equal(metricOf(result.metrics, "audit.high"), 2);
  assert.equal(metricOf(result.metrics, "audit.low"), 4);
});

/** `npm audit` cannot read a yarn.lock and vice versa; asking the wrong one reports nothing. */
test("audit is skipped where there is no lockfile", async () => {
  const { audit } = await import("../packages/scoria/src/probes/audit.ts");
  const project = { typescript: true, installed: true, packageManager: undefined, stacks: ["ts"] };
  const status = await audit.detect(contextWith(files, { project }));
  assert.equal(status.kind, "skipped");
});

test("coverage reads istanbul's json-summary", async () => {
  const { coverage } = await import("../packages/scoria/src/probes/coverage.ts");
  const report = JSON.stringify({ total: { lines: { pct: 82.5 }, branches: { pct: 61 }, functions: { pct: 90 } } });
  const result = await coverage.run(contextWith(files, { readText: () => Promise.resolve(report) }));
  assert.equal(metricOf(result.metrics, "coverage.line_pct"), 82.5);
  assert.equal(metricOf(result.metrics, "coverage.branch_pct"), 61);
});

/** Running a project's suite to get a number is invasive; without a report the answer is skipped. */
test("coverage is skipped rather than assumed when no report exists", async () => {
  const { coverage } = await import("../packages/scoria/src/probes/coverage.ts");
  const result = await coverage.run(contextWith(files));
  assert.equal(result.status.kind, "skipped");
  assert.match("reason" in result.status ? result.status.reason : "", /does not run/);
});

test("test-presence counts lines rather than matching file names", async () => {
  const { testPresence } = await import("../packages/scoria/src/probes/test-presence.ts");
  const withTests = [
    sourceFile("src/a.ts", ["const a = 1;", "const b = 2;", "const c = 3;", "const d = 4;"]),
    sourceFile("test/anything.ts", ["assert(a);", "assert(b);"], "test"),
  ];
  const result = await testPresence.run(contextWith(withTests));
  assert.equal(metricOf(result.metrics, "test-presence.test_to_source_ratio"), 0.5);
});

test("test-presence reports zero for a repository with no tests", async () => {
  const { testPresence } = await import("../packages/scoria/src/probes/test-presence.ts");
  const result = await testPresence.run(contextWith(files));
  assert.equal(metricOf(result.metrics, "test-presence.test_to_source_ratio"), 0);
});

test("circular reports each cycle with the path round it", async () => {
  const { circular } = await import("../packages/scoria/src/probes/circular.ts");
  const output = JSON.stringify([
    ["a.ts", "b.ts", "c.ts"],
    ["x.ts", "y.ts"],
  ]);
  const result = await circular.run(contextWith(files, { exec: execReturning(output, 1) }));
  assert.equal(metricOf(result.metrics, "circular.cycle_count"), 2);
  assert.equal(result.findings[0]?.file, "a.ts");
  assert.match(result.findings[0]?.message ?? "", /a\.ts → b\.ts → c\.ts → a\.ts/);
});
