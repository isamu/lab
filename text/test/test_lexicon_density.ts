import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const idsFor = (source: string, adapter: LanguageAdapter = ja, genre = "business/report"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.map((finding) => finding.rule);

/** 密度を見る rule は短い文書を測らない。嵩を足すための本文。 */
const BULK = "本日の連絡です。今日も順調に進めます。明日も続けます。".repeat(20);
const BULK_EN = "We shipped the release and reported the numbers to the team. ".repeat(40);

describe("L2 の語彙表と密度", () => {
  it("新しい rule の語彙表が ja と en の両方にある", () => {
    // ここが崩れると、片方の言語でだけ動く rule ができる。四層モデルが成立しない。
    ["excessive-hedging", "cushion-phrase", "superlative", "paragraph-opener", "ai-tell"].forEach((id) => {
      assert.ok(ja.lexicons[id] !== undefined, `ja に ${id} が無い`);
      assert.ok(en.lexicons[id] !== undefined, `en に ${id} が無い`);
    });
  });

  describe("excessive-hedging", () => {
    it("invalid: 逃げの表現が重なる", () => {
      const hedges = "効果はあるかもしれません。改善すると思われます。影響が出る可能性があります。一概には言えません。".repeat(2);
      assert.ok(idsFor(`# 報告\n\n${hedges}${BULK}`).includes("excessive-hedging"));
    });

    it("valid: 言い切っていれば指摘しない", () => {
      assert.ok(!idsFor(`# 報告\n\n効果は 20% でした。来月から始めます。${BULK}`).includes("excessive-hedging"));
    });

    it("英語でも同じ rule が動く", () => {
      const hedges = "It may be useful. It seems fine. Arguably it works. It is possible that it helps. ".repeat(3);
      assert.ok(idsFor(`# Report\n\n${hedges}${BULK_EN}`, en).includes("excessive-hedging"));
    });
  });

  describe("cushion-phrase-density", () => {
    it("invalid: クッション言葉が重なる", () => {
      const cushions = "お忙しいところ恐れ入りますが確認をお願いします。差し支えなければご返信ください。もしよろしければご検討ください。".repeat(2);
      assert.ok(idsFor(`# 依頼\n\n${cushions}${BULK}`).includes("cushion-phrase-density"));
    });

    it("valid: 用件から始めていれば指摘しない", () => {
      assert.ok(!idsFor(`# 依頼\n\n11 日までに返信をお願いします。${BULK}`).includes("cushion-phrase-density"));
    });
  });

  describe("unqualified-superlative", () => {
    it("invalid: 比べる相手がない", () => {
      assert.ok(idsFor("# 提案\n\n本製品は最も速いです。業界初の仕組みです。圧倒的な性能です。").includes("unqualified-superlative"));
    });

    it("valid: 比較対象があれば指摘しない", () => {
      const source = "# 提案\n\n3 案のうち最も速いです。他社の 2 製品に比べて業界初です。前年より圧倒的です。";
      assert.ok(!idsFor(source).includes("unqualified-superlative"));
    });
  });

  describe("repeated-conjunction", () => {
    it("invalid: 段落が接続詞で始まり続ける", () => {
      const source = "# 報告\n\n本題です。\n\nまた、次の点。\n\nさらに、こちらも。\n\nそして、最後に。\n\nしかし、注意も。";
      assert.ok(idsFor(source).includes("repeated-conjunction"));
    });

    it("valid: 続かなければ指摘しない", () => {
      const source = "# 報告\n\n本題です。\n\nまた、次の点。\n\n結論はこうです。\n\nさらに、補足です。";
      assert.ok(!idsFor(source).includes("repeated-conjunction"));
    });
  });

  describe("ai-tell", () => {
    it("invalid: 言い回しが揃うと点が積み上がる", () => {
      const source = "# 記事\n\n現代社会において、この技術は重要な役割を果たしています。急速に変化する中で大きな可能性を秘めていると言えるでしょう。";
      assert.ok(idsFor(source, ja, "blog/tech").includes("ai-tell"));
    });

    it("valid: 1 つでは何も言わない", () => {
      // 単独では普通の日本語。重なったときだけ意味がある。
      assert.ok(!idsFor("# 記事\n\n現代社会において、この仕組みは動いています。", ja, "blog/tech").includes("ai-tell"));
    });

    it("重みを足し合わせる。件数ではない", () => {
      const source = "# 記事\n\n現代社会において、この技術は重要な役割を果たしています。急速に変化する中で大きな可能性を秘めていると言えるでしょう。";
      const found = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "blog/tech").findings.find((finding) => finding.rule === "ai-tell");
      assert.ok(Number(found?.values["density"] ?? 0) > Number(found?.values["count"] ?? 0));
    });
  });
});
