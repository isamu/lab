import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const fires = (source: string, rule: string, adapter: LanguageAdapter, genre = "business/report"): boolean =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.some((finding) => finding.rule === rule);

const BULK_EN = " We continued the work and reported the numbers.".repeat(40);

describe("レビューで見つかった検出の誤り", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  describe("述語の判定は節の中だけ", () => {
    it("invalid: 読点のあとに名詞が来ても、述語の受動は残す", () => {
      // 「担当者」は次の節の主語。前の節の受動を修飾していない。
      assert.ok(fires("仕様は変更され、担当者が確認した。", "agentless-passive", ja));
    });

    it("valid: 同じ節の中で名詞を修飾していれば消す", () => {
      assert.ok(!fires("定期的に開催されるBootCampに参加してください。", "agentless-passive", ja));
    });

    it("valid: 述語の受動はそのまま", () => {
      assert.ok(fires("一定の協力が求められます。", "agentless-passive", ja));
    });
  });

  describe("略語の展開は 2 つの形を認める", () => {
    it("valid: Continuous Integration (CI)", () => {
      assert.ok(!fires(`# R\n\nContinuous Integration (CI) improves it.${BULK_EN}`, "undefined-acronym", en));
    });

    it("valid: CI (continuous integration)", () => {
      assert.ok(!fires(`# R\n\nCI (continuous integration) helps.${BULK_EN}`, "undefined-acronym", en));
    });

    it("invalid: 展開が無ければ指摘する", () => {
      assert.ok(fires(`# R\n\nSRE and SLO and RPO and MTTR matter.${BULK_EN}`, "undefined-acronym", en));
    });
  });

  describe("be と過去分詞の間に接続詞が立てる", () => {
    it("invalid: was fully and carefully reviewed", () => {
      assert.ok(fires("# R\n\nThe report was fully and carefully reviewed.", "agentless-passive", en));
    });

    it("invalid: was slowly but surely adopted", () => {
      assert.ok(fires("# R\n\nThe plan was slowly but surely adopted.", "agentless-passive", en));
    });

    it("valid: by 句があれば指摘しない", () => {
      assert.ok(!fires("# R\n\nThe report was fully and carefully reviewed by the committee.", "agentless-passive", en));
    });
  });

  describe("同数なら少数派は無い", () => {
    it("valid: 見出しが 1 対 1", () => {
      // どちらかを「他と違う」と呼ぶのは、選びかたが恣意的になる。
      assert.ok(!fires("## About the parser\n\nText here.\n\n## Usage Example Here\n\nText here.", "title-case-consistency", en, "blog/tech"));
    });

    it("invalid: 2 対 1 なら少数派がある", () => {
      const source = "## About the parser\n\nT.\n\n## When using arrays\n\nT.\n\n## Usage Example Here\n\nT.";
      assert.ok(fires(source, "title-case-consistency", en, "blog/tech"));
    });

    it("valid: 並列の読点が 1 対 1", () => {
      const source = "# R\n\nWe shipped the parser, the renderer, and the exporter.\nWe tested the code, the docs and the samples.";
      assert.ok(!fires(source, "oxford-comma-consistency", en, "blog/tech"));
    });
  });
});
