import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";

// 誰がしたのか書かれていない（agentless-passive）。例文はすべて自作。

const RULE = "agentless-passive";

const messagesOf = (text: string, adapter: LanguageAdapter = ja): string[] => {
  const rules = loadRules(adapter.id);
  const rule = rules.find((candidate) => candidate.id === RULE);
  return runRules(buildDocument("t.md", `# T\n\n${text}\n`, adapter), rules, { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => (rule === undefined ? "" : messageOf(rule, finding, adapter.id)));
};

describe("agentless-passive", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("時の起点の「から」は、した人を言わない", () => {
    ["来月から、保存先の変更が決定されました。", "4月1日から料金が改定されます。", "本日から新しい規程が導入されます。", "10時から会議が開かれる。"].forEach(
      (text) => assert.equal(messagesOf(text).length, 1, text),
    );
  });

  it("人や組織から受けた受け身の「から」は、した人を言う", () => {
    ["部長から注意されました。", "3社から指摘された。", "来月から、本社から変更が通知されました。"].forEach((text) =>
      assert.deepEqual(messagesOf(text), [], text),
    );
  });

  it("指摘は受け身の印だけでなく、動詞から引く", () => {
    assert.deepEqual(messagesOf("来月から、保存先の変更が決定されました。"), ["この文は「決定され」と受け身で書かれていますが、誰がしたのかがありません"]);
    assert.deepEqual(messagesOf("メールが送られた。"), ["この文は「送られ」と受け身で書かれていますが、誰がしたのかがありません"]);
    assert.deepEqual(messagesOf("The budget was approved.", en), ['This sentence is passive ("approved") but never says who did it']);
  });
});
