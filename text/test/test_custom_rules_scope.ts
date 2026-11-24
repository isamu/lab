import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { parseCustomRules, type CustomContext } from "../packages/chaff/src/custom/parse.ts";
import { customProblemSentence } from "../packages/chaff/src/custom/problems.ts";
import { buildDocument, teamRules } from "../packages/chaff/src/document.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { configOf } from "../packages/chaff/src/config/load.ts";
import { preferOf } from "../packages/chaff/src/config/prefer.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { runCli } from "./cli-run.ts";

const CONTEXT: CustomContext = { builtIn: new Set(["preferred-term"]), useFor: ["business"], genres: ["business"], baseDir: "/project" };
const EXPLAINED = { name: { ja: "名前", en: "Name" }, why: "理由", how_to_fix: "直しかた", example: { before: "前", after: "後" } };

const one = (rule: Record<string, unknown>): RuleDefinition => {
  const [first] = parseCustomRules([{ ...EXPLAINED, id: "team-rule", ...rule }], CONTEXT).rules;
  assert.ok(first !== undefined);
  return first;
};

const problems = (rule: Record<string, unknown>): string[] =>
  parseCustomRules([{ ...EXPLAINED, id: "team-rule", ...rule }], CONTEXT).problems.map((problem) => customProblemSentence(problem, "en"));

/** A self-written document with a heading, body text, a list, a table, a quotation and a list inside the quotation. */
const DOC = [
  "# 概要。",
  "",
  "弊社の製品です。",
  "",
  "- 弊社の項目。",
  "",
  "| 項目 | 説明 |",
  "|---|---|",
  "| 窓口 | 弊社の升。 |",
  "",
  "> お客様の声：弊社の対応が良かった。",
  "> 次の行も引用です。",
  ">",
  "> - 引用の中の項目、弊社",
  "",
  "見出しの二。",
  "===",
  "",
].join("\n");

/** The line and the text found, for each finding of the rule in DOC. */
const found = (rule: RuleDefinition, source = DOC, adapter = ja): string[] =>
  runRules(buildDocument("t.md", source, adapter), [rule], {}, false, "business").findings.map(
    (finding) => `${String(finding.line)}:${String(finding.values["matched"])}`,
  );

const WORDS = { type: "words", words: { 弊社: "当社" } };

describe("custom rules: scope", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  describe("parsing", () => {
    it("keeps the scope on the rule's spec", () => {
      assert.deepEqual(one({ ...WORDS, scope: ["~quote"] }).custom, {
        type: "words",
        words: [{ avoid: "弊社", use: "当社" }],
        scope: { include: [], exclude: ["quote"] },
      });
      assert.deepEqual(one({ type: "pattern", pattern: "。", scope: "heading" }).custom, {
        type: "pattern",
        pattern: "。",
        flags: "u",
        scope: { include: ["heading"], exclude: [] },
      });
      assert.deepEqual(one(WORDS).custom, { type: "words", words: [{ avoid: "弊社", use: "当社" }] });
    });

    it("refuses an unknown name, a value that is not a list, and a scope that reads nothing", () => {
      assert.deepEqual(problems({ ...WORDS, scope: ["headline"] }), [
        "custom_rules team-rule: unknown scope headline (heading / list / table / quote / paragraph; put ~ in front of one to leave it out, as in ~quote)",
      ]);
      assert.deepEqual(problems({ ...WORDS, scope: { heading: true } }), [
        'custom_rules team-rule: cannot read scope: {"heading":true}. Write a list of names, such as [heading], [list, table] or [~quote]',
      ]);
      assert.deepEqual(problems({ ...WORDS, scope: ["list", "~list"] }), [
        'custom_rules team-rule: scope: ["list","~list"] leaves nothing to read: every part it chooses is also left out with ~',
      ]);
    });

    it("refuses a scope on a module rule, which reads the document itself", () => {
      assert.deepEqual(problems({ type: "module", module: "./rule.js", scope: ["heading"] }), [
        "custom_rules team-rule: a type: module rule cannot have a scope; the module chooses what it reads",
      ]);
    });

    it("says it in Japanese too", () => {
      const [problem] = parseCustomRules([{ ...EXPLAINED, id: "team-rule", ...WORDS, scope: ["見出し"] }], CONTEXT).problems;
      assert.ok(problem !== undefined);
      assert.equal(
        customProblemSentence(problem, "ja"),
        "custom_rules の team-rule: scope の 見出し は知りません（heading / list / table / quote / paragraph。外すものは ~quote のように前に ~ を付けます）",
      );
    });
  });

  describe("what a rule with a scope reads", () => {
    it("without a scope, body text and lists, as before", () => {
      assert.deepEqual(found(one(WORDS)), ["3:弊社", "5:弊社"]);
    });

    it("heading reads only headings, ATX and setext, without their marks", () => {
      assert.deepEqual(found(one({ type: "pattern", pattern: "。", scope: ["heading"] })), ["1:。", "16:。"]);
      assert.deepEqual(found(one({ type: "pattern", pattern: "^#", scope: ["heading"] })), []);
    });

    it("quote reads quotations, the list inside one too, without the > marks", () => {
      assert.deepEqual(found(one({ ...WORDS, scope: ["quote"] })), ["11:弊社", "14:弊社"]);
      assert.deepEqual(found(one({ type: "pattern", pattern: ">", scope: ["quote"] })), []);
    });

    it("~quote reads everything else: headings, body, lists and tables", () => {
      assert.deepEqual(found(one({ ...WORDS, scope: ["~quote"] })), ["3:弊社", "5:弊社", "9:弊社"]);
    });

    it("list and table read those; a list inside a quotation is a list until ~quote takes it away", () => {
      assert.deepEqual(found(one({ ...WORDS, scope: ["list"] })), ["5:弊社", "14:弊社"]);
      assert.deepEqual(found(one({ ...WORDS, scope: ["list", "~quote"] })), ["5:弊社"]);
      assert.deepEqual(found(one({ ...WORDS, scope: ["table"] })), ["9:弊社"]);
      assert.deepEqual(found(one({ ...WORDS, scope: ["list", "table"] })), ["5:弊社", "9:弊社", "14:弊社"]);
    });

    it("paragraph reads body text outside the others", () => {
      assert.deepEqual(found(one({ ...WORDS, scope: ["paragraph"] })), ["3:弊社"]);
    });

    it("a tokens rule reads a heading's words", () => {
      const rule = one({ type: "tokens", tokens: [{ surface: "概要" }], scope: ["heading"] });
      assert.deepEqual(found(rule), ["1:概要"]);
      assert.deepEqual(found(one({ type: "tokens", tokens: [{ surface: "概要" }] })), []);
    });

    it("a GitHub alert is the writer's own text, read as body text, not as a quotation", () => {
      const alert = "# P\n\n> [!NOTE]\n> 弊社の注意書き。\n";
      assert.deepEqual(found(one({ ...WORDS, scope: ["quote"] }), alert), []);
      assert.deepEqual(found(one({ ...WORDS, scope: ["paragraph"] }), alert), ["4:弊社"]);
    });

    it("code inside a quotation is still not read", () => {
      assert.deepEqual(found(one({ ...WORDS, scope: ["quote"] }), "# P\n\n> 引用の `弊社` と弊社。\n"), ["3:弊社"]);
    });

    it("works in English", () => {
      const source = "# Our Plan.\n\nWe ship it.\n\n> The customer said: we love it.\n";
      assert.deepEqual(found(one({ type: "pattern", pattern: "\\.$", scope: ["heading"] }), source, en), ["1:."]);
      assert.deepEqual(found(one({ type: "words", words: ["love"], scope: ["~quote"] }), source, en), []);
      assert.deepEqual(found(one({ type: "words", words: ["love"], scope: ["quote"] }), source, en), ["5:love"]);
    });
  });

  describe("prefer", () => {
    it("reads the map as before, and the object form beside it", () => {
      const read = preferOf({ サーバ: "サーバー", 弊社: { use: "当社", scope: ["~quote"] }, " 空 ": "", 同じ: "同じ", 数: 3 });
      assert.deepEqual(read.prefer, { サーバ: "サーバー", 弊社: "当社" });
      assert.deepEqual(read.scopes, { 弊社: { include: [], exclude: ["quote"] } });
      assert.deepEqual(read.problems, []);
    });

    it("an object form without a scope is a plain entry", () => {
      assert.deepEqual(preferOf({ 弊社: { use: "当社" } }), { prefer: { 弊社: "当社" }, scopes: {}, problems: [] });
    });

    it("an object form without use, or with a scope that cannot be read, is a problem", () => {
      assert.deepEqual(preferOf({ 弊社: { scope: ["heading"] } }).problems, [{ avoid: "弊社", kind: "no-use" }]);
      assert.deepEqual(preferOf({ 弊社: { use: "  " } }).problems, [{ avoid: "弊社", kind: "no-use" }]);
      assert.deepEqual(preferOf({ 弊社: { use: "当社", scope: ["headline"] } }), {
        prefer: {},
        scopes: {},
        problems: [{ avoid: "弊社", kind: "scope", scope: { kind: "unknown", written: "headline" } }],
      });
    });

    it("reads nothing from what is not a map", () => {
      [undefined, null, "サーバ", ["サーバ"], 3].forEach((raw) => assert.deepEqual(preferOf(raw), { prefer: {}, scopes: {}, problems: [] }));
    });

    it("preferred-term counts a scoped entry only in its parts, the others in the body as before", () => {
      const config = configOf({ prefer: { 弊社: { use: "当社", scope: ["~quote"] }, 製品: "商品" } }, "/p/chaff.yaml");
      const doc = buildDocument("t.md", DOC, ja, teamRules(config, "ja"));
      const rule = loadRules("ja").find((definition) => definition.id === "preferred-term");
      assert.ok(rule !== undefined);
      const findings = runRules(doc, [rule], {}, false, "business").findings.map((finding) => `${String(finding.line)}:${String(finding.values["matched"])}`);
      assert.deepEqual(findings, ["3:弊社", "3:製品", "5:弊社", "9:弊社"]);
    });
  });

  describe("the command line", () => {
    const CONFIG = [
      "language: ja",
      "prefer:",
      "  弊社: { use: 当社, scope: [~quote] }",
      "custom_rules:",
      "  - id: heading-no-period",
      "    type: pattern",
      "    pattern: '。'",
      "    scope: [heading]",
      "    name: 見出しに句点を付けない",
      "    why: 見出しは文ではないため",
      "    how_to_fix: 句点を取ります",
      "    example:",
      "      before: '## 概要。'",
      "      after: '## 概要'",
      "",
    ].join("\n");
    const PAGE = "# 概要。\n\n弊社の方針です。\n\n> 弊社の対応が早かったです。\n";

    it("reports the period in the heading and 弊社 outside the quotation only", async () => {
      const run = await runCli({ "chaff.yaml": CONFIG, "a.md": PAGE }, ["a.md", "--compact"]);
      assert.match(run.out, /見出しに句点を付けない/u);
      assert.match(run.out, /「弊社」/u);
      assert.equal(run.out.match(/「弊社」/gu)?.length, 1);
      assert.doesNotMatch(run.out, /:5:/u);
    });

    it("an unknown scope name stops the run, in Japanese and English", async () => {
      const bad = CONFIG.replace("scope: [~quote]", "scope: [~blockquote]");
      const jaRun = await runCli({ "chaff.yaml": bad, "a.md": PAGE }, ["a.md"]);
      assert.equal(jaRun.code, 1);
      assert.match(jaRun.err, /prefer の 弊社: scope の ~blockquote は知りません/u);
      const enRun = await runCli({ "chaff.yaml": bad.replace("language: ja\n", ""), "a.md": PAGE }, ["a.md"], "en_US.UTF-8");
      assert.equal(enRun.code, 1);
      assert.match(enRun.err, /prefer 弊社: unknown scope ~blockquote/u);
      const badRule = CONFIG.replace("scope: [heading]", "scope: [title]");
      const ruleRun = await runCli({ "chaff.yaml": badRule, "a.md": PAGE }, ["a.md"]);
      assert.equal(ruleRun.code, 1);
      assert.match(ruleRun.err, /custom_rules の heading-no-period: scope の title は知りません/u);
    });

    it("explain says what the rule reads", async () => {
      const explained = await runCli({ "chaff.yaml": CONFIG }, ["explain", "heading-no-period"]);
      assert.match(explained.out, /読む所: \[heading\]/u);
    });
  });
});
