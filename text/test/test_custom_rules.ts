import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { regexRefusal, MAX_PATTERN_LENGTH } from "../packages/chaff/src/custom/regex-safety.ts";
import { posTags, tokenRuns } from "../packages/chaff/src/custom/token-pattern.ts";
import { parseCustomRules, type CustomContext } from "../packages/chaff/src/custom/parse.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { RuleDefinition, Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { runCli } from "./cli-run.ts";

const CONTEXT: CustomContext = { builtIn: new Set(["preferred-term"]), useFor: ["business", "blog"] };
const EXPLAINED = {
  name: { ja: "名前", en: "Name" },
  why: "理由",
  how_to_fix: "直しかた",
  example: { before: "前", after: "後" },
};

const parsed = (raw: unknown): { ids: string[]; problems: string[] } => {
  const result = parseCustomRules(raw, CONTEXT);
  return { ids: result.rules.map((rule) => rule.id), problems: result.problems.map((problem) => problem.kind) };
};

const one = (rule: Record<string, unknown>): RuleDefinition => {
  const [first] = parseCustomRules([{ ...EXPLAINED, ...rule }], CONTEXT).rules;
  assert.ok(first !== undefined);
  return first;
};

/** The findings of one custom rule in a source, as "matched→preferred". */
const found = (rule: RuleDefinition, source: string, adapter = ja): string[] =>
  runRules(buildDocument("t.md", source, adapter), [rule], {}, false, "business/report").findings.map(
    (finding) => `${String(finding.values["matched"])}→${String(finding.values["preferred"])}`,
  );

const token = (surface: string, pos: string, lemma?: string): Token => ({
  span: { start: 0, end: surface.length },
  surface,
  pos,
  ...(lemma === undefined ? {} : { lemma }),
});

describe("custom rules", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  describe("regexRefusal: a pattern that can run away is refused before it runs", () => {
    const safe = [
      "\\b(TBD|TODO)\\b",
      "お世話になって(おり|い)ます",
      "[0-9]{4}年",
      "(ab){2}c",
      "a+b+",
      "[(+)*]x",
      "\\(a+\\)+",
      "(?:株式会社|有限会社)\\S+",
      "(ab)+c",
      "(a{2}b)+c",
      "(cat|dog)+",
      "(?:Mr\\.|Dr\\.)+ \\S+",
      "(ab)?c",
      "(\\d+年)?\\d+月",
      "(a?b){2}",
      "(?:株式|有限)会社",
      "\\d+年\\d+月\\d+日",
      "[(a+)+]x",
    ];
    safe.forEach((pattern) => {
      it(`runs ${pattern}`, () => {
        assert.equal(regexRefusal(pattern, "u"), undefined);
      });
    });
    const refused: readonly (readonly [string, string])[] = [
      ["(a+)+b", "nested-quantifier"],
      ["(a|aa)*b", "nested-quantifier"],
      ["(\\w+\\s?)*x", "nested-quantifier"],
      ["(?:x*y)+z", "nested-quantifier"],
      ["((ab)+)+", "nested-quantifier"],
      ["((a+)b)+c", "nested-quantifier"],
      ["(cat|car)+x", "nested-quantifier"],
      ["(a{1,10})+b", "nested-quantifier"],
      ["(a?)+b", "nested-quantifier"],
      ["(a+){1,10}b", "nested-quantifier"],
      ["(a|ab)+c", "nested-quantifier"],
      ["(\\w|x)+c", "nested-quantifier"],
      ["a*a*a*a*b", "too-many-repeats"],
      ["a{0,100}a{0,100}a{0,100}a{0,100}b", "too-many-repeats"],
      ["((a|aa))+b", "nested-quantifier"],
      ["(x(a+))+b", "nested-quantifier"],
      ["(a{2,})+", "nested-quantifier"],
      ["(.)\\1", "backreference"],
      ["(?<w>a)\\k<w>", "backreference"],
      ["a*", "empty-match"],
      ["(x|)", "empty-match"],
      ["(", "invalid"],
      ["a".repeat(MAX_PATTERN_LENGTH + 1), "too-long"],
    ];
    refused.forEach(([pattern, why]) => {
      it(`refuses ${pattern.slice(0, 20)} (${why})`, () => {
        assert.equal(regexRefusal(pattern, "u"), why);
      });
    });
  });

  describe("token patterns", () => {
    it("reads UPOS and the everyday names in both languages", () => {
      assert.deepEqual(posTags("NOUN"), ["NOUN"]);
      assert.deepEqual(posTags("noun"), ["NOUN"]);
      assert.deepEqual(posTags("名詞"), ["NOUN", "PROPN", "PRON", "NUM"]);
      assert.deepEqual(posTags("Verb"), ["VERB"]);
      assert.equal(posTags("めいし"), undefined);
    });

    it("finds each run in order, without overlap", () => {
      const tokens = [
        token("調査", "NOUN"),
        token("を", "ADP"),
        token("行い", "VERB", "行う"),
        token("、", "PUNCT"),
        token("確認", "NOUN"),
        token("を", "ADP"),
        token("行う", "VERB", "行う"),
      ];
      assert.deepEqual(tokenRuns(tokens, [{ pos: ["NOUN"] }, { surface: "を" }, { base: "行う" }]), [
        [0, 2],
        [4, 6],
      ]);
      assert.deepEqual(tokenRuns(tokens, [{ pos: ["NOUN"] }, { base: "行う" }]), []);
      assert.deepEqual(tokenRuns(tokens, []), []);
      const nouns = [token("東京", "NOUN"), token("都", "NOUN"), token("庁", "NOUN")];
      assert.deepEqual(tokenRuns(nouns, [{ pos: ["NOUN"] }, { pos: ["NOUN"] }]), [[0, 1]]);
    });

    it("compares surface and base form without case", () => {
      assert.deepEqual(tokenRuns([token("ASAP", "ADV")], [{ surface: "asap" }]), [[0, 0]]);
      assert.deepEqual(tokenRuns([token("Made", "VERB", "Make")], [{ base: "make" }]), [[0, 0]]);
    });
  });

  describe("parseCustomRules", () => {
    it("reads the three types into rules like the built-in ones", () => {
      const words = one({ id: "team-kudasai", type: "words", words: { 下さい: "ください" } });
      assert.equal(words.how_to_find, "custom-words");
      assert.equal(words.status, "stable");
      assert.equal(words.severity, "warning");
      assert.deepEqual(words.levels, { strict: 3, normal: 2, relaxed: 1 });
      assert.deepEqual(words.use_for, ["business", "blog"]);
      assert.deepEqual(one({ id: "team-tbd", type: "pattern", pattern: "TBD", ignore_case: true, level: "error" }).custom, {
        type: "pattern",
        pattern: "TBD",
        flags: "iu",
      });
      const tokens = one({ id: "team-okonau", type: "tokens", tokens: [{ pos: "名詞" }, { surface: "を" }, { base: "行う" }] });
      assert.deepEqual(tokens.requires, ["pos"]);
      assert.equal(tokens.layer, "L3");
    });

    it("an error rule has no strict, an info rule no relaxed", () => {
      assert.deepEqual(one({ id: "a", type: "pattern", pattern: "x", level: "error" }).levels, { normal: 3, relaxed: 2 });
      assert.deepEqual(one({ id: "b", type: "pattern", pattern: "x", level: "info" }).levels, { strict: 2, normal: 1 });
    });

    it("a string for a text is used in both languages; a map may give one language", () => {
      const rule = one({ id: "c", type: "pattern", pattern: "x", why: { en: "Because" } });
      assert.deepEqual(rule.why, { en: "Because" });
      assert.deepEqual(rule.how_to_fix, { ja: "直しかた", en: "直しかた" });
    });

    const problems: readonly (readonly [string, unknown, string])[] = [
      ["not a list", { id: "x" }, "not-a-list"],
      ["an entry that is not a map", ["x"], "not-a-map"],
      ["a bad id", [{ ...EXPLAINED, id: "Team_Rule", type: "pattern", pattern: "x" }], "bad-id"],
      ["a built-in id", [{ ...EXPLAINED, id: "preferred-term", type: "pattern", pattern: "x" }], "built-in-id"],
      ["no type", [{ ...EXPLAINED, id: "x" }], "missing"],
      ["an unknown type", [{ ...EXPLAINED, id: "x", type: "regex", pattern: "x" }], "unknown-type"],
      ["type module, not yet", [{ ...EXPLAINED, id: "x", type: "module", file: "./x.js" }], "not-yet"],
      ["no example", [{ ...EXPLAINED, example: { before: "前" }, id: "x", type: "pattern", pattern: "x" }], "missing"],
      ["no why", [{ ...EXPLAINED, why: "", id: "x", type: "pattern", pattern: "x" }], "missing"],
      ["a bad level", [{ ...EXPLAINED, id: "x", type: "pattern", pattern: "x", level: "loud" }], "bad-level"],
      ["bad languages", [{ ...EXPLAINED, id: "x", type: "pattern", pattern: "x", languages: [""] }], "bad-languages"],
      ["no words", [{ ...EXPLAINED, id: "x", type: "words", words: {} }], "no-words"],
      ["only same-word pairs", [{ ...EXPLAINED, id: "x", type: "words", words: { a: "a" } }], "no-words"],
      ["no pattern", [{ ...EXPLAINED, id: "x", type: "pattern" }], "missing"],
      ["a runaway pattern", [{ ...EXPLAINED, id: "x", type: "pattern", pattern: "(a+)+" }], "bad-pattern"],
      ["no tokens", [{ ...EXPLAINED, id: "x", type: "tokens", tokens: [] }], "no-tokens"],
      ["an empty token", [{ ...EXPLAINED, id: "x", type: "tokens", tokens: [{}] }], "bad-token"],
      ["an unknown part of speech", [{ ...EXPLAINED, id: "x", type: "tokens", tokens: [{ pos: "めいし" }] }], "unknown-pos"],
    ];
    problems.forEach(([what, raw, kind]) => {
      it(`reports ${what} and leaves the rule out`, () => {
        const result = parsed(raw);
        assert.deepEqual(result.ids, []);
        assert.ok(result.problems.includes(kind), `${kind} in ${result.problems.join(", ")}`);
      });
    });

    it("the second rule with an id is reported; the first still runs", () => {
      const rule = { ...EXPLAINED, id: "x", type: "pattern", pattern: "x" };
      assert.deepEqual(parsed([rule, rule]), { ids: ["x"], problems: ["duplicate-id"] });
    });

    it("nothing written is nothing to do", () => {
      assert.deepEqual(parsed(undefined), { ids: [], problems: [] });
    });
  });

  describe("through the rules", () => {
    it("words: each spelling to avoid, not inside the spelling to use", () => {
      const rule = one({ id: "team-kudasai", type: "words", words: { 下さい: "ください", ユーザ: "ユーザー" } });
      assert.deepEqual(found(rule, "# 依頼\n\nご確認下さい。ユーザーとユーザに送ります。\n"), ["下さい→ください", "ユーザ→ユーザー"]);
    });

    it("words as a list only points at each word", () => {
      const rule = one({ id: "team-banned", type: "words", words: ["ASAP"] });
      assert.deepEqual(found(rule, "# Plan\n\nSend it asap please. Send it ASAP.\n", en), ["asap→", "ASAP→"]);
    });

    it("pattern: every match, case-insensitive when asked", () => {
      const rule = one({ id: "team-tbd", type: "pattern", pattern: "\\b(TBD|TODO)\\b", ignore_case: true });
      assert.deepEqual(found(rule, "# Plan\n\nThe date is TBD. The owner is tbd. TBDX is a name.\n", en), ["TBD→", "tbd→"]);
    });

    it("tokens (ja): 「〜を行う」 in any inflection", () => {
      const rule = one({ id: "team-okonau", type: "tokens", tokens: [{ pos: "名詞" }, { surface: "を" }, { base: "行う" }] });
      assert.deepEqual(found(rule, "# 報告\n\n調査を行いました。確認をします。\n"), ["調査を行い→"]);
    });

    it("words and patterns read a word broken across lines as one", () => {
      const words = one({ id: "team-kansuru", type: "words", words: { 関する: "関係する" } });
      const pattern = one({ id: "team-kansuru-pattern", type: "pattern", pattern: "関する" });
      const source = "# T\n\nこれは関\nする文です。\n";
      assert.deepEqual(found(words, source), ["関する→関係する"]);
      assert.deepEqual(found(pattern, source), ["関する→"]);
      const at = runRules(buildDocument("t.md", source, ja), [words], {}, false, "business/report").findings[0];
      assert.deepEqual([at?.line, at?.column], [3, 4]);
    });

    it("tokens (en): make + a + decision by base form", () => {
      const rule = one({ id: "team-make-decision", type: "tokens", tokens: [{ base: "make" }, { pos: "DET" }, { surface: "decision" }] });
      assert.deepEqual(found(rule, "# Notes\n\nWe made a decision. We will decide.\n", en), ["made a decision→"]);
    });

    it("the level is the finding's severity; relaxed lowers it", () => {
      const rule = one({ id: "team-tbd", type: "pattern", pattern: "TBD", level: "error" });
      const at = (level: "normal" | "relaxed"): string[] =>
        runRules(buildDocument("t.md", "# P\n\nIt is TBD.\n", en), [rule], { "team-tbd": level }, false, "business/report").findings.map(
          (finding) => finding.severity,
        );
      assert.deepEqual(at("normal"), ["error"]);
      assert.deepEqual(at("relaxed"), ["warning"]);
    });

    it("a pattern that runs past its time is stopped, and the rule is listed as not run", () => {
      const rule = one({ id: "team-slow", type: "pattern", pattern: "x" });
      const slow: RuleDefinition = { ...rule, custom: { type: "pattern", pattern: "(a|a)+b", flags: "u" } };
      const started = performance.now();
      const result = runRules(buildDocument("t.md", `# P\n\n${"a".repeat(40)}.\n`, en), [slow], {}, false, "business/report");
      assert.ok(performance.now() - started < 5000);
      assert.deepEqual(result.findings, []);
      assert.match(result.skipped.find((skip) => skip.rule === "team-slow")?.why ?? "", /did not finish within 1000 ms/u);
    });

    it("languages limits where a rule runs, and says why it did not", () => {
      const rule = one({ id: "team-tbd", type: "pattern", pattern: "TBD", languages: ["ja"] });
      const result = runRules(buildDocument("t.md", "# P\n\nIt is TBD.\n", en), [rule], {}, false, "business/report");
      assert.deepEqual(result.findings, []);
      assert.ok(result.skipped.some((skip) => skip.rule === "team-tbd"));
    });
  });

  describe("the command line", () => {
    const CONFIG = [
      "language: ja",
      "custom_rules:",
      "  - id: team-tbd",
      "    type: pattern",
      "    pattern: '\\b(TBD|未定)\\b'",
      "    level: error",
      "    name: 未定のまま",
      "    why: 決まっていないことを決まったように読ませないため",
      "    how_to_fix: 決める人と期限を書きます",
      "    example:",
      "      before: 公開日は TBD です。",
      "      after: 公開日は 10 月 1 日です（佐藤が 9 月 20 日までに決めます）。",
      "",
    ].join("\n");
    const DOC = "# 計画\n\n公開日は TBD です。\n";

    it("a finding like any rule's, with the team's name and the example in explain", async () => {
      const run = await runCli({ "chaff.yaml": CONFIG, "a.md": DOC }, ["a.md", "--compact"]);
      assert.match(run.out, /error +未定のまま:「TBD」/u);
      assert.equal(run.code, 1);
      const explained = await runCli({ "chaff.yaml": CONFIG }, ["explain", "team-tbd"]);
      assert.match(explained.out, /例: {2}公開日は TBD です。\n {6}→ {2}公開日は 10 月 1 日です/u);
      assert.match(explained.out, /chaff\.yaml の custom_rules で決めたもの/u);
    });

    it("stet silences it by its id", async () => {
      const run = await runCli({ "chaff.yaml": CONFIG, "a.md": `# 計画\n\n<!-- stet: team-tbd \u2014 仮の原稿 -->\n公開日は TBD です。\n` }, [
        "a.md",
        "--compact",
      ]);
      assert.doesNotMatch(run.out, /未定のまま/u);
      assert.equal(run.code, 0);
    });

    it("rules --json and SARIF carry it", async () => {
      const json = await runCli({ "chaff.yaml": CONFIG }, ["rules", "--json"]);
      assert.match(json.out, /"id": "team-tbd"[\s\S]*"defined_in": "chaff.yaml custom_rules"/u);
      const sarif = await runCli({ "chaff.yaml": CONFIG, "a.md": DOC }, ["a.md", "--sarif", "out.sarif"]);
      assert.match(readFileSync(join(sarif.dir, "out.sarif"), "utf8"), /"ruleId": "chaff\/team-tbd"/u);
    });

    it("relax lowers it like a built-in rule", async () => {
      const run = await runCli({ "chaff.yaml": CONFIG }, ["relax", "team-tbd", "--why", "下書きの段階"]);
      assert.equal(run.code, 0);
      assert.match(readFileSync(join(run.dir, "chaff.yaml"), "utf8"), /team-tbd: relaxed/u);
    });

    it("a rule that cannot run stops the run and says why", async () => {
      const bad = CONFIG.replace("'\\b(TBD|未定)\\b'", "'(a+)+'");
      const run = await runCli({ "chaff.yaml": bad, "a.md": DOC }, ["a.md"]);
      assert.equal(run.code, 1);
      assert.match(run.err, /custom_rules の team-tbd: pattern を使えません。繰り返しの中に繰り返しがあります/u);
    });
  });
});
