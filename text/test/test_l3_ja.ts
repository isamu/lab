import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

const RULES = loadRules("ja");

const idsFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, {}, true, "business/report").findings.map((finding) => finding.rule);

const countFor = (source: string, rule: string): number => idsFor(source).filter((id) => id === rule).length;

describe("L3 日本語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  describe("no-mixed-desumasu", () => {
    it("invalid: ですます調の中に 1 文だけ である調が混ざる", () => {
      assert.ok(idsFor("運用を始めます。手順を作ります。研修も予定しています。効果は来期に測定する。").includes("no-mixed-desumasu"));
    });

    it("valid: ですます調で揃っていれば指摘しない", () => {
      assert.ok(!idsFor("運用を始めます。手順を作ります。効果は来期に測定します。").includes("no-mixed-desumasu"));
    });

    it("valid: である調で揃っていれば指摘しない", () => {
      assert.ok(!idsFor("運用を始める。手順を作る。効果は来期に測定する。").includes("no-mixed-desumasu"));
    });

    it("valid: 述語を持たない断片は文として数えない", () => {
      // 見出しの下の名前だけの行。実文書の誤検知はすべてこれだった。
      assert.ok(!idsFor("運用を始めます。手順を作ります。研修も予定しています。\n\nMaaSサービス\n\nWeb3").includes("no-mixed-desumasu"));
    });
  });

  describe("no-doubled-joshi", () => {
    it("invalid: 「の」が読点を挟まずに 3 回続く", () => {
      assert.equal(countFor("弊社の新製品の販売の計画を説明します。", "no-doubled-joshi"), 1);
    });

    it("valid: 読点で区切られた並列は数えない", () => {
      assert.equal(countFor("サービスの運営や、ドキュメントの作成、イベントの運営などです。", "no-doubled-joshi"), 0);
    });

    it("valid: 「も」の並列と「て」の連用は何重でも読める", () => {
      assert.equal(countFor("実装もテストもレビューも機械に移しました。", "no-doubled-joshi"), 0);
      assert.equal(countFor("そのままコピーして持っていってください。", "no-doubled-joshi"), 0);
    });

    it("valid: 他の助詞で句が閉じたら、そこで連なりは切れる", () => {
      assert.equal(countFor("弊社の新製品は他社の製品の後に出ます。", "no-doubled-joshi"), 0);
    });
  });

  describe("taigen-dome-in-prose", () => {
    const five = "手当ては2系統。原因は設定漏れ。対象は全社員。期限は今月末。方針は据え置き。結論は現状維持。";

    it("invalid: 本文で体言止めが続く", () => {
      assert.ok(idsFor(five).includes("taigen-dome-in-prose"));
    });

    it("文書あたり 1 件にまとめる。1 文ずつ並べない", () => {
      assert.equal(countFor(five, "taigen-dome-in-prose"), 1);
    });

    it("valid: 箇条書きの体言止めは数えない", () => {
      const list = five
        .split("。")
        .filter((part) => part.length > 0)
        .map((part) => `- ${part}。`)
        .join("\n");
      assert.ok(!idsFor(list).includes("taigen-dome-in-prose"));
    });

    it("valid: 「〜のか」の「の」は体言止めではない", () => {
      const questions = "なぜ速いのか。どこが効くのか。誰が決めるのか。いつ出すのか。何を測るのか。どう直すのか。";
      assert.ok(!idsFor(questions).includes("taigen-dome-in-prose"));
    });

    it("valid: 述語で終わる文が並んでも指摘しない", () => {
      assert.ok(!idsFor("手当ては2系統です。原因は設定漏れです。対象は全社員です。期限は今月末です。方針は据え置きです。").includes("taigen-dome-in-prose"));
    });
  });

  it("日本語の rule は英語で動かさない", () => {
    const result = runRules(buildDocument("t.md", "The plan of the sale of the product.", en), loadRules("en"), {}, true, "business/report");
    ["no-mixed-desumasu", "no-doubled-joshi", "taigen-dome-in-prose"].forEach((id) => {
      assert.ok(
        result.skipped.some((entry) => entry.rule === id),
        `${id} が skip されていない`,
      );
    });
  });
});
