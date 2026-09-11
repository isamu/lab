import { test } from "node:test";
import assert from "node:assert/strict";
import { isLang, messagesFor } from "../packages/scoria/src/messages.ts";
import { renderReport } from "../packages/scoria/src/render.ts";
import type { Report } from "../packages/scoria/src/report.ts";

const report: Report = {
  schemaVersion: 1,
  root: "demo-repo",
  profile: "app",
  stacks: ["ts"],
  complete: true,
  size: { files: 2, sloc: 10, testSloc: 4 },
  dimensions: [
    {
      dimension: "integrity",
      status: "experimental",
      score: 50,
      coverage: 1,
      metrics: [],
      confidence: "high",
      confidenceReason: "0 suppressions in scope",
    },
  ],
  findings: [
    {
      rule: "as-any-no-reason",
      severity: "error",
      file: "src/a.ts",
      line: 3,
      message: "bypasses the type checker, with no reason given",
      probe: "suppression-scan",
      dimension: "integrity",
      tier: 0,
    },
  ],
  probes: [{ probe: "suppression-scan", status: { kind: "ok" } }],
  overall: { score: 50, scoredDimensions: 1, comparable: false },
};

const context = { source: "detected", drift: { added: [], missing: [] }, notice: undefined };

test("accepts only known language codes", () => {
  assert.equal(isLang("en"), true);
  assert.equal(isLang("ja"), true);
  assert.equal(isLang("fr"), false);
  assert.equal(isLang(undefined), false);
});

test("renders English by default", () => {
  const text = renderReport(report, { ...context, lang: "en" });
  assert.match(text, /Dimension/);
  assert.match(text, /not comparable across repos/);
  assert.match(text, /bypasses the type checker/);
});

test("renders Japanese when asked", () => {
  const text = renderReport(report, { ...context, lang: "ja" });
  assert.match(text, /次元/);
  assert.match(text, /repo 間では比較できません/);
  assert.match(text, /型を迂回しています/);
});

/** The machine-readable message never changes; only what a person sees does. */
test("translation does not touch the report itself", () => {
  renderReport(report, { ...context, lang: "ja" });
  assert.equal(report.findings[0]?.message, "bypasses the type checker, with no reason given");
});

test("a rule with no translation falls back to the English message", () => {
  const messages = messagesFor("ja");
  assert.equal(messages.ruleMessages["no-such-rule"], undefined);
});

test("explain carries the files that drove a metric", async () => {
  const { buildReport } = await import("../packages/scoria/src/report.ts");
  const built = buildReport(
    "demo-repo",
    [],
    [
      {
        probe: "file-shape",
        status: { kind: "ok" },
        metrics: [
          {
            id: "file-shape.sloc_p95",
            value: 300,
            unit: "lines",
            topContributors: [{ file: "src/big.ts", value: 2673 }],
          },
        ],
        findings: [],
        toolVersions: {},
        durationMs: 0,
      },
    ],
    [
      {
        id: "readability",
        status: "experimental",
        metrics: [{ metric: "file-shape.sloc_p95", scale: { good: 150, bad: 800 }, weight: 1 }],
        confidenceFrom: [],
      },
    ],
  );
  const metric = built.dimensions[0]?.metrics[0];
  assert.deepEqual(metric?.topContributors, [{ file: "src/big.ts", value: 2673 }]);
});

test("the GitHub summary renders a table with a bar per dimension", async () => {
  const { renderGithubSummary } = await import("../packages/scoria/src/summary.ts");
  const markdown = renderGithubSummary(report, "en");
  assert.match(markdown, /^## scoria — 50 \/ 100$/m);
  assert.match(markdown, /\| integrity \| 50 \| `█████░░░░░` \| high \|/);
  assert.match(markdown, /<details><summary>1 findings at severity error<\/summary>/);
  assert.match(markdown, /src\/a\.ts:3/);
});

test("the GitHub summary follows the language too", async () => {
  const { renderGithubSummary } = await import("../packages/scoria/src/summary.ts");
  assert.match(renderGithubSummary(report, "ja"), /型を迂回しています/);
});

/** Silence would look identical to a clean repository, so the note is not optional. */
test("the GitHub summary always states that scores are not comparable", async () => {
  const { renderGithubSummary } = await import("../packages/scoria/src/summary.ts");
  assert.match(renderGithubSummary(report, "en"), /not comparable across repositories/);
  assert.match(renderGithubSummary(report, "ja"), /他のリポジトリと比べられません/);
});
