import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const RULES = loadRules("en");

const idsFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), RULES, {}, true, "business/report").findings.map((finding) => finding.rule);

/** adverb-overuse は 200 語未満を測らない。密度を見る test はこれで嵩を足す。 */
const padded = (source: string): string => `${source}\n\n${"We shipped the release and the team reported the numbers. ".repeat(22)}`;

describe("L3 英語", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  describe("adverb-overuse", () => {
    it("invalid: -ly 副詞の密度が高い", () => {
      const source = "The team moved quickly and delivered carefully. We wrote the code rapidly and reviewed it thoroughly and shipped it smoothly.";
      assert.ok(idsFor(padded(source)).includes("adverb-overuse"));
    });

    it("valid: 副詞が少なければ指摘しない", () => {
      assert.ok(!idsFor(padded("The team hurried and delivered. We wrote the code and reviewed it.")).includes("adverb-overuse"));
    });

    it("短い文書は測らない。密度が暴れるため", () => {
      assert.ok(!idsFor("We moved quickly and carefully and thoroughly.").includes("adverb-overuse"));
    });
  });

  describe("expletive-construction", () => {
    it("invalid: There is / It is ... that が重なる", () => {
      const source = "There is a need to review. There are risks. It is clear that we must act. There is no answer.";
      assert.ok(idsFor(source).includes("expletive-construction"));
    });

    it("valid: 主語が前に出ていれば指摘しない", () => {
      const source = "The board must review the budget. Several risks remain. We must act now. Nobody has an answer.";
      assert.ok(!idsFor(source).includes("expletive-construction"));
    });

    it("valid: that 節を伴わない it is は数えない", () => {
      // "It is raining" は正当な用法。
      const source = "It is raining. It is cold. It is late. It is quiet.";
      assert.ok(!idsFor(source).includes("expletive-construction"));
    });
  });

  describe("sentence-initial-conjunction-run", () => {
    it("invalid: 接続詞で始まる文が 4 つ続く", () => {
      assert.ok(
        idsFor("We shipped it. And we told the team. But the schedule slipped. So we adjusted. Yet nobody complained.").includes(
          "sentence-initial-conjunction-run",
        ),
      );
    });

    it("valid: 1 つだけなら指摘しない", () => {
      assert.ok(!idsFor("We shipped it. And we told the team. The schedule held.").includes("sentence-initial-conjunction-run"));
    });
  });

  describe("title-case-consistency", () => {
    it("invalid: sentence case の中に Title Case が 1 つ", () => {
      const source = "## About the parser\n\nText.\n\n## When using arrays\n\nText.\n\n## Usage Example Here\n\nText.";
      assert.ok(idsFor(source).includes("title-case-consistency"));
    });

    it("valid: 揃っていれば指摘しない", () => {
      const source = "## About the parser\n\nText.\n\n## When using arrays\n\nText.\n\n## Usage example here\n\nText.";
      assert.ok(!idsFor(source).includes("title-case-consistency"));
    });

    it("1 語の見出しは判定できない。どちらの流儀でも先頭は大文字", () => {
      const source = "## Parser\n\nText.\n\n## Renderer\n\nText.\n\n## Exporter\n\nText.";
      assert.ok(!idsFor(source).includes("title-case-consistency"));
    });
  });

  describe("oxford-comma-consistency", () => {
    it("invalid: 打つ文と打たない文が混ざる", () => {
      const source =
        "We shipped the parser, the renderer, and the exporter.\nThe team reviewed the plan, the budget, and the schedule.\nWe tested the code, the docs and the samples.";
      assert.ok(idsFor(source).includes("oxford-comma-consistency"));
    });

    it("valid: 揃っていれば、どちらの流儀でも指摘しない", () => {
      const with_ = "We shipped the parser, the renderer, and the exporter.\nWe tested the code, the docs, and the samples.";
      const without = "We shipped the parser, the renderer and the exporter.\nWe tested the code, the docs and the samples.";
      assert.ok(!idsFor(with_).includes("oxford-comma-consistency"));
      assert.ok(!idsFor(without).includes("oxford-comma-consistency"));
    });

    it("2 つの並列は判定しない。読点が入らないため", () => {
      assert.ok(!idsFor("We shipped the parser and the renderer.\nWe tested the code, the docs, and the samples.").includes("oxford-comma-consistency"));
    });
  });

  it("英語の rule は日本語で動かさない", () => {
    const result = runRules(buildDocument("t.md", "これは文です。", ja), loadRules("ja"), {}, true, "business/report");
    ["adverb-overuse", "expletive-construction", "title-case-consistency", "oxford-comma-consistency"].forEach((id) => {
      assert.ok(
        result.skipped.some((entry) => entry.rule === id),
        `${id} が skip されていない`,
      );
    });
  });

  it("書き出しの同じさは、英語では語で測る", () => {
    // 文字で切ると "We continued" が "Wecont" になり、引用がそのまま読み手に出る。
    const source = "We continued the work and reported the numbers. ".repeat(5);
    const findings = runRules(buildDocument("t.md", source, en), RULES, {}, true, "blog/tech").findings;
    const head = findings.find((finding) => finding.rule === "repeated-sentence-head");
    assert.equal(head?.values["head"], "We continued the");
  });
});
