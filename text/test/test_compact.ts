import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderCompact } from "../packages/chaff/src/render/compact.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { RunResult } from "../packages/chaff/src/run.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";

// --compact の最後の集計の行。画面のほかの部分と同じく文書の言語で出す。行ごとの重さの語は英語のまま。

const resultWith = (findings: number, skipped: number): RunResult => ({
  findings: Array.from({ length: findings }, (_, index): Finding => ({
    rule: "max-sentence-length",
    severity: "warning",
    line: index + 1,
    column: 1,
    quote: "文",
    values: { count: 120, limit: 100 },
  })),
  skipped: Array.from({ length: skipped }, (_, index) => ({ rule: `r${String(index)}`, why: "理由" })),
  forcedExperimental: [],
});

const tailOf = (text: string): string => text.trimEnd().split("\n").at(-1) ?? "";

describe("renderCompact の集計", () => {
  it("日本語の文書は日本語で、読点でつなぐ", () => {
    assert.equal(tailOf(renderCompact("a.md", resultWith(6, 33), loadRules("ja"), "ja")), "指摘 6 件、動いていない rule 33 件");
    assert.equal(tailOf(renderCompact("a.md", resultWith(0, 0), loadRules("ja"), "ja")), "指摘 0 件");
  });

  it("英語の文書はこれまでどおり、単数と複数を分ける", () => {
    assert.equal(tailOf(renderCompact("a.md", resultWith(1, 1), loadRules("en"), "en")), "1 finding, 1 rule not run");
    assert.equal(tailOf(renderCompact("a.md", resultWith(2, 3), loadRules("en"), "en")), "2 findings, 3 rules not run");
  });

  it("行ごとの重さの語は、日本語の文書でも英語のまま", () => {
    assert.match(renderCompact("a.md", resultWith(1, 0), loadRules("ja"), "ja"), /^ {2}1:1 {5}warning /mu);
  });
});
