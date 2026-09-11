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
  overall: { score: 50, comparable: false },
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
