import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const RULE = "excessive-hedging";

const hedgesIn = (source: string, adapter: LanguageAdapter = ja, genre = "business/report"): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter((finding) => finding.rule === RULE);

const stackedIn = (source: string, adapter: LanguageAdapter = ja): Finding[] => hedgesIn(source, adapter).filter((finding) => finding.variant === "stacked");

/** 重なりの指摘 1 件を、その言語の画面の文で。 */
const onlyMessage = (found: readonly Finding[], language: string): string => {
  const rule = loadRules(language).find((entry) => entry.id === RULE);
  const [finding] = found;
  assert.ok(rule !== undefined && finding !== undefined && found.length === 1);
  return messageOf(rule, finding, language);
};

describe("excessive-hedging: 1 つの文に逃げの表現を重ねる", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  describe("日本語", () => {
    it("invalid: 「という状況」で包んで、さらに「と考えられます」でぼかす", () => {
      const found = stackedIn("# 報告\n\n対応していくことが求められているという状況であると考えられます。\n");
      assert.match(onlyMessage(found, "ja"), /「という状況である、と考えられます」/u);
    });

    it("invalid: 「かもしれない」と「と思われます」を重ねる", () => {
      assert.equal(stackedIn("# 報告\n\n来月には改善するかもしれないと思われます。\n").length, 1);
    });

    it("invalid: 「かと思われる可能性があります」は 3 つ重なっている", () => {
      const found = stackedIn("# 報告\n\n原因は設定の誤りかと思われる可能性があります。\n");
      assert.equal(found.length, 1);
      assert.equal(found[0]?.values["count"], 3);
    });

    it("invalid: である調でも、活用した形でも原形で照らす", () => {
      assert.equal(stackedIn("# 報告\n\n効果が出るかもしれないと考えられる。\n").length, 1);
    });

    it("valid: 逃げの表現が 1 つなら慎重さで、重ねてはいない", () => {
      assert.deepEqual(stackedIn("# 報告\n\n担当者の増員についても検討を進めることが必要であると考えられます。\n"), []);
      assert.deepEqual(stackedIn("# 報告\n\n来月には改善するかもしれません。\n"), []);
    });

    it("valid: 包む言い方だけでは逃げていない", () => {
      assert.deepEqual(stackedIn("# 報告\n\n問い合わせが増えているという状況です。\n"), []);
    });

    it("valid: 鉤括弧で引いた発言の中の逃げは、書き手のものではない", () => {
      assert.deepEqual(stackedIn("# 報告\n\n部長は「来月には改善するかもしれないと思われます」と話しました。\n"), []);
      assert.deepEqual(stackedIn("# 報告\n\n部長は「来月には改善するかもしれない」と話しており、遅れると考えられます。\n"), []);
    });

    it("valid: どこで成り立つかを言う「場合がある」は、逃げの重なりに数えない", () => {
      assert.deepEqual(stackedIn("# 報告\n\n設定を誤ると失敗する場合があると考えられます。\n"), []);
    });

    it("valid: 読点で切れた別の節の逃げは、同じ主張を二重にぼかしていない", () => {
      assert.deepEqual(stackedIn("# 報告\n\n漏えいした可能性がある情報が、悪用される可能性があります。\n"), []);
    });

    it("短い文書でも指摘する。密度は測らない長さでも、重なりは 1 文で分かる", () => {
      const found = hedgesIn("# 報告\n\n改善するかもしれないと思われます。\n");
      assert.equal(found.length, 1);
      assert.equal(found[0]?.values["density"], undefined);
    });
  });

  describe("English", () => {
    it('invalid: "may possibly"', () => {
      const found = stackedIn("# Report\n\nThe change may possibly reduce errors.\n", en);
      assert.match(onlyMessage(found, "en"), /"may, possibly"/u);
    });

    it('invalid: "it could perhaps be argued"', () => {
      assert.equal(stackedIn("# Report\n\nIt could perhaps be argued that the plan works.\n", en).length, 1);
    });

    it("valid: one hedge is caution", () => {
      assert.deepEqual(stackedIn("# Report\n\nThe change may reduce errors.\n", en), []);
      assert.deepEqual(stackedIn("# Report\n\nPerhaps the plan works.\n", en), []);
    });

    it('valid: "it could be" is one hedge, not "could" and another', () => {
      assert.deepEqual(stackedIn("# Report\n\nIt could be faster.\n", en), []);
    });

    it('invalid: "might" is read once, though it is both "may" (its base form) and "might"', () => {
      assert.equal(stackedIn("# Report\n\nIt might possibly rain.\n", en).length, 1);
    });

    it("valid: two softening words with no hedge are not a stacked hedge", () => {
      assert.deepEqual(stackedIn("# Report\n\nThe service may fail if the disk might fill.\n", en), []);
    });

    it('valid: "in some cases" says where a claim holds, not how sure it is', () => {
      assert.deepEqual(stackedIn("# Report\n\nIn some cases the API may accept the key as a parameter.\n", en), []);
    });

    it("valid: hedges in two clauses joined by a conjunction do not stack", () => {
      assert.deepEqual(stackedIn("# Report\n\nThe fix could fail and it may be slow.\n", en), []);
    });

    it("valid: a hedge inside a quotation is the speaker's", () => {
      assert.deepEqual(stackedIn('# Report\n\nThe manager said, "it may possibly rain," so we moved the date.\n', en), []);
      assert.deepEqual(stackedIn("# Report\n\nThe manager said “it may possibly rain” and we moved the date.\n", en), []);
    });
  });

  it("文書全体の密度でも指摘される文書で、重ねた文は 1 度だけ、重なりとして言う", () => {
    const hedges = "効果はあるかもしれません。改善すると思われます。影響が出る可能性があります。一概には言えません。".repeat(3);
    const bulk = "本日の連絡です。今日も順調に進めます。明日も続けます。".repeat(20);
    const found = hedgesIn(`# 報告\n\n${hedges}\n\n改善するかもしれないと思われます。\n\n${bulk}\n`);
    const onStacked = found.filter((finding) => finding.line === 5);
    assert.ok(found.some((finding) => finding.variant === undefined));
    assert.deepEqual(
      onStacked.map((finding) => finding.variant),
      ["stacked"],
    );
  });

  it("message は見つけ方で選ぶ。見つけ方の文が無ければ rule の message で言う", () => {
    const rule = loadRules("en").find((entry) => entry.id === RULE);
    assert.ok(rule !== undefined);
    const values = { matched: "may, possibly", count: 2, density: 7, limit: 6 };
    const at = { rule: RULE, severity: "warning" as const, line: 1, column: 1, quote: "", values };
    assert.equal(messageOf(rule, { ...at, variant: "stacked" }, "en"), 'This sentence stacks 2 hedges ("may, possibly")');
    assert.equal(messageOf(rule, { ...at, variant: "unknown" }, "en"), '"may, possibly" and other hedges: 7 per 1000 words (limit 6)');
    assert.equal(messageOf(rule, at, "en"), '"may, possibly" and other hedges: 7 per 1000 words (limit 6)');
  });
});
