import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument, type TeamRules } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { configOf } from "../packages/chaff/src/config/load.ts";
import { consistentProblems } from "../packages/chaff/src/config/consistent-problems.ts";
import { groupHits } from "../packages/chaff/src/term-groups.ts";
import { crossDocTermVariant } from "../packages/chaff/src/detectors/cross-variant.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const team = (consistent: readonly (readonly string[])[]): TeamRules => ({ jargon: [], requiredSections: [], consistent });

const runOf = (adapter: LanguageAdapter, source: string, groups: readonly (readonly string[])[]) =>
  runRules(buildDocument("t.md", source, adapter, team(groups)), loadRules(adapter.id), {}, false, "business/report");

const found = (adapter: LanguageAdapter, source: string, groups: readonly (readonly string[])[]): string[] =>
  runOf(adapter, source, groups)
    .findings.filter((finding) => finding.rule === "term-consistency")
    .map((finding) => `${String(finding.values["matched"])}→${String(finding.values["preferred"] ?? finding.values["forms"])}`);

const CUSTOMER = [["顧客", "お客様"]];
const SIGN_IN = [["log in", "sign in"]];

describe("term-consistency", () => {
  describe("finds a mix", () => {
    it("the less-used member, in Japanese", () => {
      const source = "# 案内\n\n顧客の声を集めます。顧客ごとに担当を決めます。お客様には来週連絡します。\n";
      assert.deepEqual(found(ja, source, CUSTOMER), ["お客様→顧客"]);
    });

    it("the less-used member, in English, whatever the case", () => {
      const source = "# Help\n\nLog in with your email. If you cannot log in, reset your password. Then sign in again.\n";
      assert.deepEqual(found(en, source, SIGN_IN), ["sign in→log in"]);
    });

    it("a tie: one finding that names both, and takes no side", () => {
      const source = "# Help\n\nLog in with your email. Then sign in again.\n";
      const findings = runOf(en, source, SIGN_IN).findings.filter((finding) => finding.rule === "term-consistency");
      assert.equal(findings.length, 1);
      assert.equal(findings[0]?.variant, "tie");
      assert.equal(findings[0]?.values["forms"], "log in, sign in");
    });

    it("each group on its own", () => {
      const source = "# 案内\n\n顧客に申込書を送ります。顧客の申し込みは二件です。お客様の申込は三件です。申込は来週までです。\n";
      assert.deepEqual(found(ja, source, [...CUSTOMER, ["申込", "申し込み"]]), ["申し込み→申込", "お客様→顧客"]);
    });
  });

  describe("leaves alone", () => {
    it("a document that uses one member", () => {
      assert.deepEqual(found(ja, "# 案内\n\n顧客の声を集めます。顧客ごとに担当を決めます。\n", CUSTOMER), []);
    });

    it("a member inside a longer word", () => {
      assert.deepEqual(
        groupHits("Use the login page to log in.", SIGN_IN).map((hit) => hit.member),
        ["log in"],
      );
    });

    it("a member inside a longer member", () => {
      assert.deepEqual(
        groupHits("申し込みと申込。", [["申し込み", "申し込"]]).map((hit) => hit.member),
        ["申し込み"],
      );
    });
  });

  describe("when nothing is listed", () => {
    it("does not run, and says why, in both languages", () => {
      const english = runOf(en, "# Help\n\nLog in. Then sign in.\n", []).skipped.find((entry) => entry.rule === "term-consistency");
      assert.match(english?.why ?? "", /consistent in chaff\.yaml/u);
      const japanese = runOf(ja, "# 案内\n\n連絡します。\n", []).skipped.find((entry) => entry.rule === "term-consistency");
      assert.match(japanese?.why ?? "", /chaff\.yaml の consistent/u);
    });
  });

  describe("across documents (cross-doc-term-variant)", () => {
    const docOf = (path: string, source: string) => buildDocument(path, source, ja, team(CUSTOMER));

    it("a file that uses the member the other files do not", () => {
      const docs = [docOf("a.md", "# A\n\n顧客に連絡します。\n"), docOf("b.md", "# B\n\n顧客の声です。\n"), docOf("c.md", "# C\n\nお客様に送ります。\n")];
      const odd = crossDocTermVariant(docs, { limit: 1 }).map(
        (entry) => `${entry.path}:${String(entry.finding.values["matched"])}→${String(entry.finding.values["preferred"])}`,
      );
      assert.deepEqual(odd, ["c.md:お客様→顧客"]);
    });

    it("files that agree", () => {
      const docs = [docOf("a.md", "# A\n\n顧客に連絡します。\n"), docOf("b.md", "# B\n\n顧客の声です。\n")];
      assert.deepEqual(crossDocTermVariant(docs, { limit: 1 }), []);
    });
  });

  describe("chaff.yaml", () => {
    it("reads groups", () => {
      const config = configOf(
        {
          consistent: [
            ["顧客", "お客様"],
            ["log in", " sign in "],
          ],
        },
        "/x/chaff.yaml",
      );
      assert.deepEqual(config.consistent, [
        ["顧客", "お客様"],
        ["log in", "sign in"],
      ]);
      assert.deepEqual(consistentProblems(config), []);
    });

    it("reports what it cannot read, in both languages", () => {
      const config = configOf({ consistent: [["顧客"], "お客様", ["a", "a"], ["b", { x: 1 }]] }, "/x/chaff.yaml");
      assert.equal(config.consistent?.length, 0);
      assert.equal(consistentProblems(config, "en").length, 4);
      assert.match(consistentProblems(config, "en")[0] ?? "", /cannot read \["顧客"\] under consistent as a group/u);
      assert.match(consistentProblems(config, "ja")[0] ?? "", /consistent の \["顧客"\] は組として読めません/u);
      assert.equal(consistentProblems(configOf({ consistent: "顧客" }, "/x/chaff.yaml"), "en").length, 1);
    });

    it("reports a word listed in two groups", () => {
      const config = configOf(
        {
          consistent: [
            ["顧客", "お客様"],
            ["お客様", "ユーザー"],
          ],
        },
        "/x/chaff.yaml",
      );
      assert.match(consistentProblems(config, "en")[0] ?? "", /"お客様" is in two groups/u);
      assert.match(consistentProblems(config, "ja")[0] ?? "", /「お客様」が二つの組に/u);
    });

    it("no key, no groups and no problems", () => {
      const config = configOf({}, "/x/chaff.yaml");
      assert.deepEqual(config.consistent, []);
      assert.deepEqual(consistentProblems(config), []);
    });
  });
});
