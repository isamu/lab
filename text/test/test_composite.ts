import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";

const RULES = loadRules("ja");

const findingsFor = (source: string): readonly Finding[] => runRules(buildDocument("t.md", source, ja), RULES, {}, true, "blog/tech").findings;

const idsFor = (source: string): string[] => findingsFor(source).map((finding) => finding.rule);

const THREES = [
  "できることは 3 つです。\n\n- 速い\n- 安い\n- 強い",
  "使いかたも 3 つです。\n\n- 読む\n- 書く\n- 直す",
  "注意点も 3 つです。\n\n- 準備\n- 実行\n- 確認",
].join("\n\n");

/** ai-tell / rule-of-three / padded-intro / closing-cliche の 4 種が出る文書。 */
const MANY = [
  "# はじめに",
  "",
  "近年、この分野は急速に変化する状況にあります。現代社会において、重要な役割を果たしていると言えるでしょう。",
  "",
  THREES,
  "",
  "まとめると、大きな可能性を秘めていると言えるでしょう。ぜひ参考にしてみてください。",
].join("\n");

describe("複合シグナル", () => {
  it("invalid: 3 種そろったら 1 件にまとめて出す", () => {
    assert.ok(idsFor(MANY).includes("ai-generated-composite"));
  });

  it("どの signal がそろったのかを言う", () => {
    const found = findingsFor(MANY).find((finding) => finding.rule === "ai-generated-composite");
    assert.match(String(found?.values["word"] ?? ""), /ai-tell/u);
    assert.ok(Number(found?.values["count"] ?? 0) >= 3);
  });

  it("valid: 1 種だけでは出さない", () => {
    // 単独では普通の文章に出る。揃ったときだけ意味がある。
    assert.ok(!idsFor("# はじめに\n\n近年、この仕組みが動いています。中身はこうです。").includes("ai-generated-composite"));
  });

  it("元の指摘は消さない", () => {
    // まとめるために消すと、単独でも正しい指摘（padded-intro）が見えなくなる。
    const ids = idsFor(MANY);
    assert.ok(ids.includes("padded-intro"));
    assert.ok(ids.includes("ai-generated-composite"));
  });

  it("一段目で「検出器が無い」と言わせない", () => {
    const result = runRules(buildDocument("t.md", MANY, ja), RULES, {}, true, "blog/tech");
    assert.ok(!result.skipped.some((entry) => entry.rule === "ai-generated-composite"));
  });

  it("設定で止められる", () => {
    const result = runRules(buildDocument("t.md", MANY, ja), RULES, { "ai-generated-composite": "off" }, true, "blog/tech");
    assert.ok(!result.findings.some((finding) => finding.rule === "ai-generated-composite"));
  });
});

describe("no-em-dash", () => {
  const BULK = "本日の連絡です — 今日も順調に進めています。明日も続けます — 引き続きお願いします。".repeat(16);
  const BULK_EN = "We shipped it — and the team reported the numbers — on Friday. ".repeat(40);

  it("invalid: ダッシュが多い", () => {
    assert.ok(idsFor(`# 報告\n\n${BULK}`).includes("no-em-dash"));
  });

  it("valid: 読点で書いていれば指摘しない", () => {
    assert.ok(!idsFor(`# 報告\n\n${"本日の連絡です。今日も順調に進めています。".repeat(20)}`).includes("no-em-dash"));
  });

  it("severity が言語で変わる。記号の許容度は言語で違う", () => {
    // 日本語の組版ではダッシュが扱いにくく、英語では正当な用法が多い。
    const jaSeverity = findingsFor(`# 報告\n\n${BULK}`).find((finding) => finding.rule === "no-em-dash")?.severity;
    const enFindings = runRules(buildDocument("t.md", `# Report\n\n${BULK_EN}`, en), loadRules("en"), {}, true, "blog/tech").findings;
    assert.equal(jaSeverity, "warning");
    assert.equal(enFindings.find((finding) => finding.rule === "no-em-dash")?.severity, "info");
  });

  it("複合シグナルの入力になっている", () => {
    const composite = loadRules("ja").find((rule) => rule.id === "ai-generated-composite");
    assert.ok(composite?.from.includes("no-em-dash"));
  });
});
