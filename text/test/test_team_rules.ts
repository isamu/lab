import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { TeamRules } from "../packages/chaff/src/document.ts";

const RULES = loadRules("ja");

const NONE: TeamRules = { jargon: [], requiredSections: [] };

const idsFor = (source: string, team: TeamRules = NONE, genre = "business/proposal"): string[] =>
  runRules(buildDocument("t.md", source, ja, team), RULES, {}, true, genre).findings.map((finding) => finding.rule);

const PROPOSAL = "# 提案\n\n## 背景\n\n他部署にも横展開したいと考えています。先方と握った内容を共有します。\n\n## 提案\n\n運用は当面こちらで巻き取ります。";

describe("チームが決める rule", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  describe("internal-jargon", () => {
    it("invalid: chaff.yaml に並べた語を見つける", () => {
      assert.ok(idsFor(PROPOSAL, { jargon: ["横展開", "握る"], requiredSections: [] }).includes("internal-jargon"));
    });

    it("活用していても原形で当たる", () => {
      // 利用者は辞書形で書く（握る）が、本文は活用している（握った）。
      const found = runRules(buildDocument("t.md", PROPOSAL, ja, { jargon: ["握る"], requiredSections: [] }), RULES, {}, true, "business/proposal").findings;
      assert.ok(found.some((finding) => finding.rule === "internal-jargon" && finding.values["matched"] === "握る"));
    });

    it("複合動詞は語幹で書けば当たる", () => {
      // 「巻き取ります」は 巻き[巻く] + 取り[取る] に割れるので、原形の「巻き取る」は現れない。
      assert.ok(idsFor(PROPOSAL, { jargon: ["巻き取"], requiredSections: [] }).includes("internal-jargon"));
    });

    it("何も並べていなければ何も言わない。用語の登録を押しつけない", () => {
      assert.ok(!idsFor(PROPOSAL).includes("internal-jargon"));
    });
  });

  describe("required-sections", () => {
    it("invalid: 決めた見出しが無い", () => {
      assert.ok(idsFor(PROPOSAL, { jargon: [], requiredSections: ["リスク", "費用"] }).includes("required-sections"));
    });

    it("valid: 揃っていれば指摘しない", () => {
      const source = `${PROPOSAL}\n\n## リスク\n\n影響は限定的です。\n\n## 費用\n\n30 万円です。`;
      assert.ok(!idsFor(source, { jargon: [], requiredSections: ["リスク", "費用"] }).includes("required-sections"));
    });

    it("見出しに含まれていれば足りる", () => {
      // 「リスクと対策」でも「リスク」の節があると見る。見出しの文言までは縛らない。
      const source = `${PROPOSAL}\n\n## リスクと対策\n\n影響は限定的です。`;
      assert.ok(!idsFor(source, { jargon: [], requiredSections: ["リスク"] }).includes("required-sections"));
    });

    it("何も決めていなければ何も言わない", () => {
      assert.ok(!idsFor(PROPOSAL).includes("required-sections"));
    });
  });

  describe("proper-noun-density", () => {
    const BULK = "本日の連絡です。今日も順調に進めます。".repeat(10);

    it("invalid: 固有名詞が続く", () => {
      const names = "MulmoCast と GraphAI と Receptron と Anthropic の話です。".repeat(8);
      assert.ok(idsFor(`# 紹介\n\n${names}${BULK}`, NONE, "blog/tech").includes("proper-noun-density"));
    });

    it("valid: 普通の文章なら指摘しない", () => {
      assert.ok(!idsFor(`# 紹介\n\n${BULK}`, NONE, "blog/tech").includes("proper-noun-density"));
    });
  });
});
