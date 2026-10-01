import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const idsFor = (source: string, adapter: LanguageAdapter = ja, genre = "business/report"): string[] => firedRules(adapter, source, genre);

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
    // 語彙表は活用する語を原形で書いている。原形で照らすには品詞が要る（CLI は rule の uses: [pos] で用意する）。
    before(async () => {
      await ja.prepare?.({ pos: true });
      await en.prepare?.({ pos: true });
    });

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

    const SHORT_EMAIL = (body: string): string => `# Follow-up\n\nHi Dana,\n\n${body}\n\nBest regards,\nSam\n`;
    const cushionFindings = (
      source: string,
      adapter: LanguageAdapter = en,
      level: "strict" | "normal" = "normal",
    ): readonly { readonly values: Record<string, unknown> }[] =>
      runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "cushion-phrase-density": level }, true, "business/email").findings.filter(
        (finding) => finding.rule === "cushion-phrase-density",
      );

    it("invalid: three softeners piled into a short email are reported, with the document's own density", () => {
      const body =
        "I hope this email finds you well. I just wanted to reach out about the invoice we sent last week. Sorry to bother you, but could you confirm the payment date?";
      const findings = cushionFindings(SHORT_EMAIL(body));
      assert.deepEqual(
        findings.map((finding) => finding.values["matched"]),
        ["hope this email finds you well", "just wanted to", "sorry to bother"],
      );
      assert.ok(Number(findings[0]?.values["density"]) > 50, "the density shown is the document's own");
    });

    it("valid: in a short email, two softeners pass at normal and one passes even at strict", () => {
      const two = "Sorry to bother you, but could you review this when you get a chance?";
      assert.deepEqual(cushionFindings(SHORT_EMAIL(two)), []);
      assert.equal(cushionFindings(SHORT_EMAIL(two), en, "strict").length, 2);
      assert.deepEqual(cushionFindings(SHORT_EMAIL("Sorry to bother you, but could you confirm the payment date by Friday?"), en, "strict"), []);
    });

    it("短い日本語のメール: 三つで指摘し、「お忙しいところ恐れ入りますが」の二つは通す", () => {
      const three = "お忙しいところ恐れ入りますが、請求書をご確認ください。差し支えなければ、金曜までにご返信ください。";
      assert.equal(cushionFindings(`# ご確認のお願い\n\n${three}\n`, ja).length, 3);
      assert.deepEqual(cushionFindings(`# ご確認のお願い\n\nお忙しいところ恐れ入りますが、請求書をご確認ください。\n`, ja), []);
      assert.deepEqual(cushionFindings(`# ご確認のお願い\n\n恐れ入りますが、請求書をご確認ください。\n`, ja, "strict"), []);
    });

    it("valid: a short document is still not measured for hedges (they are found stacked in one sentence instead)", () => {
      const hedges = "It may be useful. Perhaps it helps. Arguably it works. Possibly it scales.";
      assert.ok(!idsFor(`# Note\n\n${hedges}\n`, en).includes("excessive-hedging"));
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
