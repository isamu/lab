import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const idsFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech").findings.map((finding) => finding.rule);

describe("contraction-consistency", () => {
  it("invalid: 短縮形と長い形が混ざる", () => {
    const source = "# Report\n\nWe don't ship on Fridays. It's a rule we keep.\nThe team cannot change it. The process is not negotiable.";
    assert.ok(idsFor(source).includes("contraction-consistency"));
  });

  it("valid: 短縮形で揃っていれば指摘しない", () => {
    const source = "# Report\n\nWe don't ship on Fridays. It's a rule we keep.\nWe can't change it. It isn't negotiable.";
    assert.ok(!idsFor(source).includes("contraction-consistency"));
  });

  it("valid: 長い形で揃っていれば指摘しない", () => {
    // どちらが正しいかは決めない。1 つの文書で揃っているかだけを見る。
    const source = "# Report\n\nWe do not ship on Fridays. It is a rule we keep.\nWe cannot change it. It is not negotiable.";
    assert.ok(!idsFor(source).includes("contraction-consistency"));
  });

  it("語の境界で照合する。部分一致だと「it isn't」が「it is」を含む", () => {
    const source = "# Report\n\nWe don't ship. It isn't negotiable. We can't change it. We won't revisit it.";
    assert.ok(!idsFor(source).includes("contraction-consistency"));
  });

  it("語彙表が対を持つ。片方だけでは硬い文体と不統一を区別できない", () => {
    const pairs = en.lexicons["contraction"] ?? [];
    assert.ok(pairs.length > 0);
    assert.ok(pairs.every((entry) => entry.instead_of !== undefined));
  });

  it("日本語では動かさない。表記ゆれは別の話", () => {
    const result = runRules(buildDocument("t.md", "これは文です。", ja), loadRules("ja"), {}, true, "blog/tech");
    assert.ok(result.skipped.some((entry) => entry.rule === "contraction-consistency"));
  });
});
