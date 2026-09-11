import { test } from "node:test";
import assert from "node:assert/strict";
import { scriptLinesOnly, stackVue } from "../packages/scoria/src/stacks/vue.ts";
import { suppressionScan } from "../packages/scoria/src/probes/suppression-scan.ts";
import { contextOf, loadFixture } from "./helpers.ts";

test(".vue は source として分類される", () => {
  assert.equal(stackVue.classify("src/components/Button.vue"), "source");
  assert.equal(stackVue.classify("src/components/Button.test.vue"), "test");
  assert.equal(stackVue.classify("src/components/Button.ts"), "ignored");
  assert.equal(stackVue.classify("node_modules/x/Button.vue"), "ignored");
});

test("script の外は空白になり、行番号は保たれる", () => {
  const lines = ["<template>", "  <p>as any</p>", "</template>", "<script>", "const a = 1;", "</script>"];
  const code = scriptLinesOnly(lines);
  assert.equal(code.length, lines.length);
  assert.equal((code[1] ?? "").trim(), "");
  assert.match(code[4] ?? "", /const a = 1;/);
});

test("template と style の囮から 1 件も検出しない", async () => {
  const file = await loadFixture("vue/decoy.vue");
  const result = await suppressionScan.run(contextOf([file]));
  assert.deepEqual(result.findings, []);
});

test("script の中の抑制は検出し、行番号が原文と一致する", async () => {
  const file = await loadFixture("vue/suppressed.vue");
  const result = await suppressionScan.run(contextOf([file]));
  const rules = result.findings.map((finding) => finding.rule).sort((a, b) => a.localeCompare(b));
  assert.deepEqual(rules, ["as-any-no-reason", "eslint-disable-no-reason"]);
  const eslintFinding = result.findings.find((finding) => finding.rule === "eslint-disable-no-reason");
  assert.equal(eslintFinding?.line, 7);
  assert.match(file.lines[6] ?? "", /eslint-disable-next-line/);
});
