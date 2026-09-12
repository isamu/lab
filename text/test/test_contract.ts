import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { runSemantic } from "../packages/chaff/src/run-semantic.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { checkAdapter } from "../packages/chaff/src/adapter-load.ts";
import type { LanguageAdapter, RuleDefinition } from "../packages/chaff/src/plugin.ts";

/** 契約を満たさないものを通すと、例外ではなく「指摘 0 件」で終わる。0 件は問題なしと区別できない。 */
describe("契約を満たさないものを黙って通さない", () => {
  it("pos を宣言していても token が来なければ動かさない", () => {
    // pos: true と宣言しながら token を返さないアダプタ。prepare は呼ばない。
    const liar: LanguageAdapter = {
      kind: ja.kind,
      id: ja.id,
      apiVersion: ja.apiVersion,
      capabilities: ja.capabilities,
      detect: ja.detect,
      lexicons: ja.lexicons,
      segment: (text) => ({ sentences: ja.segment(text).sentences.map(({ span, text: body }) => ({ span, text: body })) }),
    };
    const result = runRules(buildDocument("t.md", "一定の協力が求められます。", liar), loadRules("ja"), {}, true, "business/report");
    const skipped = result.skipped.find((entry) => entry.rule === "agentless-passive");
    assert.match(skipped?.why ?? "", /品詞を返さなかった/u);
    assert.ok(!result.findings.some((finding) => finding.rule === "agentless-passive"));
  });

  it("絞り込みの無い L4 rule は動かさず、理由を出す", async () => {
    // spec §14。落とすと、書いていない範囲が黙って LLM に送られる。
    const rules = loadRules("ja");
    const risk = rules.find((rule) => rule.id === "risk-disclosure");
    if (risk === undefined) throw new Error("risk-disclosure が無い");
    const broken: RuleDefinition = { ...risk, how_to_find: "typo" };
    const doc = buildDocument("t.md", "# 提案\n\n施策の話です。効果があります。", ja);
    const result = await runSemantic(doc, [broken], [], {}, "business/proposal", {
      model: "x",
      backend: "anthropic",
      cacheDir: join(mkdtempSync(join(tmpdir(), "chaff-")), "cache"),
      confidenceThreshold: 0.7,
    });
    assert.equal(result.asked, 0);
    assert.match(result.skipped.find((entry) => entry.rule === "risk-disclosure")?.why ?? "", /絞り込み/u);
  });
});

describe("アダプタの形を読み込み時に確かめる", () => {
  it("正しいアダプタは通る", () => {
    assert.equal(checkAdapter(ja), undefined);
  });

  it("契約の版が違えば断る。動かしてから壊れるより先に", () => {
    assert.match(checkAdapter({ ...ja, apiVersion: 2 }) ?? "", /apiVersion/u);
  });

  it("capabilities の形が違えば断る", () => {
    // core は lengthUnit を見て文長を測る。無いまま動かすと undefined が単位になる。
    assert.match(checkAdapter({ ...ja, capabilities: { sentenceSplit: true } }) ?? "", /capabilities/u);
    assert.match(checkAdapter({ ...ja, capabilities: { ...ja.capabilities, lengthUnit: "byte" } }) ?? "", /capabilities/u);
  });

  it("要るものが欠けていれば断る", () => {
    assert.notEqual(checkAdapter({ ...ja, detect: undefined }), undefined);
    assert.notEqual(checkAdapter({ ...ja, id: "" }), undefined);
    assert.equal(checkAdapter(null), "object ではありません");
  });
});
