import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const RULES = loadRules("ja");

const idsFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, {}, true, "business/report").findings.map((finding) => finding.rule);

describe("L3 日本語 — 文字と語彙", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  describe("max-kanji-continuous", () => {
    it("invalid: 漢字が 12 字続く", () => {
      assert.ok(idsFor("情報処理推進機構認定試験の受験者が増えました。").includes("max-kanji-continuous"));
    });

    it("valid: 助詞で割れていれば指摘しない", () => {
      assert.ok(!idsFor("情報処理推進機構の認定試験の受験者が増えました。").includes("max-kanji-continuous"));
    });

    it("valid: 実文書で普通に出る 6 字は指摘しない", () => {
      // examples/ の最長が 6 字（認知的複雑度・社会課題解決）。良い文書で出る長さは閾値の下。
      assert.ok(!idsFor("認知的複雑度を測ります。社会課題解決に取り組みます。").includes("max-kanji-continuous"));
    });

    it("覆った箇所の空白をまたいで繋がない", () => {
      // `情報処理` と `推進機構` は別のコード。間の記号は覆われて空白になる。
      assert.ok(!idsFor("`情報処理`と`推進機構`の話です。").includes("max-kanji-continuous"));
    });
  });

  describe("no-nakaguro-parallel", () => {
    it("invalid: 1 文に中黒が 6 個", () => {
      assert.ok(idsFor("企画・開発・運用・保守、営業・販売・広報・総務の体制を見直します。").includes("no-nakaguro-parallel"));
    });

    it("valid: 1 組の並列は指摘しない", () => {
      assert.ok(!idsFor("企画・開発・運用の体制を見直します。").includes("no-nakaguro-parallel"));
    });
  });

  describe("sasete-itadaku", () => {
    it("invalid: 文書内に 4 回", () => {
      const source = "検討させていただきます。調整させていただきます。確認させていただきます。報告させていただきます。";
      assert.ok(idsFor(source).includes("sasete-itadaku"));
    });

    it("valid: 1 度なら指摘しない", () => {
      assert.ok(!idsFor("検討させていただきます。来週までに結論を出します。").includes("sasete-itadaku"));
    });
  });

  describe("double-keigo", () => {
    it("invalid: 尊敬語に「られる」を重ねる", () => {
      assert.ok(idsFor("部長がおっしゃられました。").includes("double-keigo"));
    });

    it("invalid: 謙譲語に「させていただく」を重ねる", () => {
      assert.ok(idsFor("資料を拝見させていただきます。").includes("double-keigo"));
    });

    it("valid: 敬語が 1 つなら指摘しない", () => {
      assert.ok(!idsFor("部長がおっしゃいました。").includes("double-keigo"));
    });

    it("valid: 議論の分かれる形は語彙表に入れない", () => {
      // 「ご説明させていただきます」は二重敬語かで割れる。割れる形を入れると rule ごと無視される。
      assert.ok(!idsFor("ご説明させていただきます。").includes("double-keigo"));
    });
  });

  describe("hiragana-fukushi", () => {
    it("invalid: 表外漢字の副詞", () => {
      assert.ok(idsFor("殆どの項目は完了しました。").includes("hiragana-fukushi"));
    });

    it("valid: かなで書いてあれば指摘しない", () => {
      assert.ok(!idsFor("ほとんどの項目は完了しました。").includes("hiragana-fukushi"));
    });

    it("valid: 公用文で漢字が認められる副詞は見ない", () => {
      // 「既に」「全く」は漢字でよい。どちらが正しいかで割れる語を入れない。
      assert.ok(!idsFor("既に完了しました。全く問題ありません。").includes("hiragana-fukushi"));
    });
  });
});
