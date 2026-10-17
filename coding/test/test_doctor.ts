import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyFixes, diagnose } from "../packages/scoria/src/doctor.ts";
import { configGaps, configIntegrity } from "../packages/scoria/src/probes/config-integrity.ts";
import { contextOf } from "./helpers.ts";
import { ciGaps } from "../packages/scoria/src/probes/ci-integrity.ts";

const project = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "scoria-doctor-"));
  await Promise.all(
    Object.entries(files).map(async ([path, text]) => {
      await mkdir(join(root, path, "..").replace(/\/\.\.$/, "/.."), { recursive: true }).catch(() => undefined);
      const directory = path.includes("/") ? join(root, path.slice(0, path.lastIndexOf("/"))) : root;
      await mkdir(directory, { recursive: true });
      await writeFile(join(root, path), text, "utf8");
    }),
  );
  return root;
};

const ids = (gaps: readonly { id: string }[]): readonly string[] => gaps.map((gap) => gap.id);

test("reports a missing ESLint config as an error", () => {
  const gaps = configGaps([{ path: "package.json", text: "{}" }], false);
  assert.ok(ids(gaps).includes("eslint-missing"));
  assert.equal(gaps.find((gap) => gap.id === "eslint-missing")?.severity, "error");
});

test("reports flat and legacy configs living together", () => {
  const files = [
    { path: "eslint.config.js", text: "export default [];" },
    { path: ".eslintrc.json", text: "{}" },
  ];
  assert.ok(ids(configGaps(files, false)).includes("eslint-duplicate"));
});

test("reports strict mode being off", () => {
  const files = [{ path: "tsconfig.json", text: '{"compilerOptions":{"strict":false}}' }];
  assert.ok(ids(configGaps(files, true)).includes("tsconfig-strict"));
});

test("says nothing about strict mode when it is on", () => {
  const files = [{ path: "tsconfig.json", text: '{"compilerOptions":{"strict":true}}' }];
  assert.ok(!ids(configGaps(files, true)).includes("tsconfig-strict"));
});

const formatterGap = (packageJson: string) => configGaps([{ path: "package.json", text: packageJson }], false).find((gap) => gap.id === "formatter-missing");

test("reports no formatter being installed as a warning", () => {
  assert.equal(formatterGap("{}")?.severity, "warning");
  assert.equal(formatterGap('{"devDependencies":{"eslint":"^10"}}')?.severity, "warning");
});

test("a formatter config without the dependency is still not installed", () => {
  const files = [
    { path: "package.json", text: "{}" },
    { path: ".prettierrc", text: "{}" },
  ];
  assert.ok(ids(configGaps(files, false)).includes("formatter-missing"));
});

test("says nothing when Prettier, Biome or dprint is a dependency", () => {
  assert.equal(formatterGap('{"devDependencies":{"prettier":"^3"}}'), undefined);
  assert.equal(formatterGap('{"dependencies":{"prettier":"^3"}}'), undefined);
  assert.equal(formatterGap('{"devDependencies":{"@biomejs/biome":"^2"}}'), undefined);
  assert.equal(formatterGap('{"devDependencies":{"dprint":"^0.50"}}'), undefined);
});

test("a package merely named like a formatter does not count", () => {
  assert.ok(formatterGap('{"devDependencies":{"eslint-config-prettier":"^10","biome":"^0.3"}}') !== undefined);
});

const gatedProject = (devDependencies: string) => [
  { path: "package.json", text: `{"scripts":{"lint":"x","build":"x","test":"x","typecheck":"x"},"devDependencies":${devDependencies}}` },
  { path: "eslint.config.js", text: "export default [];" },
  { path: "tsconfig.json", text: '{"compilerOptions":{"strict":true}}' },
  { path: ".gitignore", text: "node_modules/\n" },
];

const integrityMetrics = async (devDependencies: string) => {
  const result = await configIntegrity.run(contextOf([], undefined, gatedProject(devDependencies)));
  return Object.fromEntries(result.metrics.map((metric) => [metric.id, metric.value]));
};

/** The gap has to reach the score, not only the doctor's list. */
test("a missing formatter raises the config gap ratio", async () => {
  const without = await integrityMetrics("{}");
  const withPrettier = await integrityMetrics('{"prettier":"^3"}');
  assert.equal(without["config-integrity.gap_count"], 1);
  assert.ok((without["config-integrity.gap_ratio"] ?? 0) > 0);
  assert.equal(withPrettier["config-integrity.gap_count"], 0);
  assert.equal(withPrettier["config-integrity.gap_ratio"], 0);
});

test("an unreadable package.json counts as no formatter", () => {
  assert.ok(formatterGap("not json") !== undefined);
  assert.ok(ids(configGaps([], false)).includes("formatter-missing"));
});

test("asks for a typecheck script only in a TypeScript project", () => {
  const files = [{ path: "package.json", text: '{"scripts":{"lint":"x","build":"x","test":"x"}}' }];
  assert.ok(ids(configGaps(files, true)).includes("script-typecheck"));
  assert.ok(!ids(configGaps(files, false)).includes("script-typecheck"));
});

/**
 * No workflow is not one gap. Counting it as one left a repository with no CI at all scoring a gap
 * ratio of 0.17 — better than one that has CI and is missing four of six checks.
 */
test("no CI workflow means every gate is missing, not one gap", () => {
  const gaps = ciGaps("/repo", [{ path: "package.json", text: "{}" }], false);
  assert.deepEqual(ids(gaps), ["ci-missing", "ci-step-lint", "ci-step-build", "ci-step-test"]);
  assert.equal(gaps[0]?.severity, "error");
});

/** A job named "test" runs nothing. The word has to appear in something a step executes. */
test("a gate is run only when a step runs it", () => {
  const named = [
    {
      path: ".github/workflows/ci.yml",
      text: "name: test\non: [push]\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n",
    },
  ];
  assert.ok(ids(ciGaps("/repo", named, false)).includes("ci-step-test"));
  const run = workflowRunning("yarn lint", "yarn build", "yarn test");
  assert.ok(!ids(ciGaps("/repo", run, false)).includes("ci-step-test"));
});

const stepLines = (scripts: readonly string[]): string => scripts.map((script) => `      - run: ${script}\n`).join("");

/** The shape a workflow actually has: steps live under a job, and a bare `steps:` is not one. */
const workflowRunning = (...scripts: readonly string[]): readonly { readonly path: string; readonly text: string }[] => [
  {
    path: ".github/workflows/ci.yml",
    text: `name: CI\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n${stepLines(scripts)}`,
  },
];

/** A job that swallows its failure is green whatever it found. */
test("reports steps that swallow their failure", () => {
  const files = workflowRunning("yarn lint && yarn build && yarn test || true");
  assert.ok(ids(ciGaps("/repo", files, false)).includes("ci-swallowed-failures"));
});

test("does not report steps CI actually runs", () => {
  assert.deepEqual(ids(ciGaps("/repo", workflowRunning("yarn lint", "yarn build", "yarn test"), false)), []);
});

test("--fix appends node_modules to .gitignore", async () => {
  const root = await project({ "package.json": '{"scripts":{"lint":"x","build":"x","test":"x"}}', ".gitignore": "dist/\n" });
  const applied = await applyFixes(await diagnose(root));
  assert.equal(applied.length, 1);
  assert.match(await readFile(join(root, ".gitignore"), "utf8"), /^node_modules\/$/m);
});

test("--fix adds a typecheck script without disturbing the others", async () => {
  const root = await project({
    "package.json": '{\n  "devDependencies": { "typescript": "^6" },\n  "scripts": {\n    "lint": "eslint ."\n  }\n}\n',
    ".gitignore": "node_modules/\n",
  });
  await applyFixes(await diagnose(root));
  const text = await readFile(join(root, "package.json"), "utf8");
  assert.match(text, /"typecheck": "tsc --noEmit"/);
  assert.match(text, /"lint": "eslint \."/);
});

/** Choosing a lint configuration for someone is a judgement; appending to .gitignore is not. */
test("leaves everything that needs a judgement alone", async () => {
  const root = await project({ "package.json": "{}", ".gitignore": "node_modules/\n" });
  const diagnosis = await diagnose(root);
  const applied = await applyFixes(diagnosis);
  assert.ok(ids(diagnosis.gaps).includes("eslint-missing"));
  assert.deepEqual(applied, []);
});
