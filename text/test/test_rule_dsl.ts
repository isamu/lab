import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCustomRules, type CustomContext, type CustomProblem } from "../packages/chaff/src/custom/parse.ts";
import { customProblemSentence } from "../packages/chaff/src/custom/problems.ts";
import { fieldProblemSentence, fieldProblems } from "../packages/chaff/src/rule-fields.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { knownGenres } from "../packages/chaff/src/known-genres.ts";
import { parsePlugin } from "../packages/chaff/src/extension/plugin-parse.ts";
import { API_VERSION } from "../packages/chaff/src/api.ts";
import { runCli } from "./cli-run.ts";

// One rule DSL: a team's custom_rules and a plugin's rules may write what chaff's own rules/*.yaml write (levels,
// use_for, group, summary, the example by language, rewrite), and all three are checked by rule-fields.ts.

const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "chaff", "rules");
const GENRES = knownGenres();
const CONTEXT: CustomContext = { builtIn: new Set(), useFor: ["business", "blog"], genres: GENRES, baseDir: "/project" };

/** A team rule as custom_rules has always written it. */
const OLD_STYLE = {
  id: "no-tbd",
  type: "words",
  words: ["TBD"],
  name: "TBD left in",
  why: "A reader cannot act on it.",
  how_to_fix: "Write what was decided.",
  example: { before: "Due TBD.", after: "Due 1 May." },
};

/** The same rule in the full DSL, as a bundled rule would write its descriptive fields. */
const FULL = {
  id: "no-tbd",
  type: "words",
  words: ["TBD"],
  name: { ja: "TBD が残っている", en: "TBD left in" },
  why: { ja: "読み手が動けません。", en: "A reader cannot act on it." },
  how_to_fix: { ja: "決めたことを書きます。", en: "Write what was decided." },
  message: { ja: "「{matched}」が残っています", en: '"{matched}" is left in' },
  levels: { strict: "error", normal: "warning", relaxed: "info" },
  use_for: ["business"],
  group: "slips",
  summary: { ja: "決めずに残した TBD", en: "A TBD nobody resolved" },
  example: { ja: { before: "期限は TBD。", after: "期限は 5 月 1 日。" }, en: { before: "Due TBD.", after: "Due 1 May." } },
  rewrite: { depth: "light", en: { direction: "Replace TBD with the decision.", pairs: [{ before: "Due TBD.", after: "Due [date]." }] } },
};

const parsed = (raw: Record<string, unknown>): ReturnType<typeof parseCustomRules> => parseCustomRules([raw], CONTEXT);
const kindsOf = (raw: Record<string, unknown>): string[] => parsed(raw).problems.map((problem) => problem.kind);

describe("rule DSL — a team rule written like a bundled one", () => {
  it("reads levels, use_for, group, summary, the example by language and rewrite", () => {
    const { rules, problems } = parsed(FULL);
    assert.deepEqual(problems, []);
    const [rule] = rules;
    assert.ok(rule !== undefined);
    assert.deepEqual(rule.levels, { strict: 3, normal: 2, relaxed: 1 });
    assert.equal(rule.severity, "warning");
    assert.deepEqual(rule.use_for, ["business"]);
    assert.equal(rule.guide?.group, "slips");
    assert.equal(rule.guide?.summary["ja"], "決めずに残した TBD");
    assert.deepEqual(rule.guide?.examples["ja"], { before: "期限は TBD。", after: "期限は 5 月 1 日。" });
    assert.equal(rule.guide?.rewriteDepth, "light");
    assert.equal(rule.guide?.rewrite["en"]?.direction, "Replace TBD with the decision.");
    assert.equal(rule.message["ja"], "「{matched}」が残っています");
  });

  it("reads an old-style rule as before: warning, every genre the context gives, group team, the name as summary", () => {
    const [rule] = parsed(OLD_STYLE).rules;
    assert.ok(rule !== undefined);
    assert.deepEqual(rule.levels, { strict: 3, normal: 2, relaxed: 1 });
    assert.deepEqual(rule.use_for, ["business", "blog"]);
    assert.equal(rule.guide?.group, "team");
    assert.deepEqual(rule.guide?.summary, rule.name);
  });

  it("level and the same levels written out read the same, for every severity", () => {
    const tables = { error: { normal: "error", relaxed: "warning" }, warning: FULL.levels, info: { strict: "warning", normal: "info" } };
    Object.entries(tables).forEach(([level, levels]) => {
      const byLevel = parsed({ ...OLD_STYLE, level });
      const byLevels = parsed({ ...OLD_STYLE, levels });
      assert.deepEqual(byLevels, byLevel, level);
    });
  });
});

describe("rule DSL — what a team rule cannot write, and what it is told", () => {
  const sentence = (raw: Record<string, unknown>, ui: "ja" | "en" = "en"): string => {
    const [problem] = parsed(raw).problems;
    assert.ok(problem !== undefined, JSON.stringify(raw));
    return customProblemSentence(problem, ui);
  };

  it("refuses level and levels together", () => {
    assert.deepEqual(kindsOf({ ...OLD_STYLE, level: "error", levels: FULL.levels }), ["level-and-levels"]);
  });

  it("refuses levels with numbers, without normal, with an unknown name or an unknown severity", () => {
    [{ normal: 3 }, { strict: "error" }, { normal: "warning", hard: "error" }, { normal: "fatal" }, "warning", ["warning"]].forEach((levels) => {
      assert.deepEqual(kindsOf({ ...OLD_STYLE, levels }), ["bad-levels"], JSON.stringify(levels));
    });
    assert.match(sentence({ ...OLD_STYLE, levels: { normal: 3 } }), /levels: \{"normal":3\}.*a number has nothing to count/u);
  });

  it("refuses a group, a use_for, a summary or a rewrite depth chaff does not know, naming the value", () => {
    assert.match(sentence({ ...OLD_STYLE, group: "misc" }), /custom_rules no-tbd: group: misc is not a group \(readability/u);
    assert.match(sentence({ ...OLD_STYLE, use_for: ["novels"] }), /use_for: novels is not a genre/u);
    assert.deepEqual(kindsOf({ ...OLD_STYLE, use_for: [] }), ["bad-use-for"]);
    assert.deepEqual(kindsOf({ ...OLD_STYLE, use_for: "business" }), ["bad-use-for"]);
    assert.match(sentence({ ...OLD_STYLE, summary: 3 }), /summary: cannot read 3/u);
    assert.match(sentence({ ...OLD_STYLE, rewrite: { depth: "deep" } }, "ja"), /custom_rules の no-tbd: rewrite\.depth: deep は書き直しの深さではありません/u);
  });

  it("refuses an example by language whose pair is not whole, and keeps reporting a { before, after } example as it always has", () => {
    const halfJa = { ...OLD_STYLE, example: { ja: { before: "期限は TBD。" }, en: { before: "Due TBD.", after: "Due 1 May." } } };
    assert.deepEqual(kindsOf(halfJa), ["bad-example"]);
    assert.match(sentence(halfJa), /example: ja lacks a before or an after/u);
    const noAfter: CustomProblem[] = [...parsed({ ...OLD_STYLE, example: { before: "Due TBD." } }).problems];
    assert.deepEqual(noAfter, [{ kind: "missing", at: "no-tbd", field: "example.after" }]);
  });
});

describe("rule DSL — one check for chaff's rules, a team's and a plugin's", () => {
  it("every bundled rule passes the shared check", () => {
    assert.doesNotThrow(() => loadRules("en"));
    assert.doesNotThrow(() => loadRules("ja"));
  });

  it("refuses a bundled rule with an unknown group with the same sentence a team rule gets", () => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-dsl-"));
    writeFileSync(join(dir, "ai-tell.yaml"), readFileSync(join(RULES_DIR, "ai-tell.yaml"), "utf8").replace(/^group: ai-tells$/mu, "group: misc"));
    const expected = fieldProblemSentence({ kind: "bad-group", written: "misc" }, "ja");
    assert.throws(
      () => loadRules("en", dir),
      (error: unknown) => error instanceof Error && error.message === `ai-tell.yaml: ${expected}`,
    );
    assert.ok(customProblemSentence({ kind: "bad-group", at: "x", written: "misc" }, "ja").endsWith(expected));
  });

  it("checks the same fields in the same order whoever wrote the rule", () => {
    const raw = { group: "misc", summary: 3, use_for: ["novels"], example: { ja: {} }, rewrite: { depth: "deep" } };
    assert.deepEqual(
      fieldProblems(raw, GENRES).map((problem) => problem.kind),
      ["bad-group", "bad-summary", "bad-use-for", "bad-example", "bad-depth"],
    );
  });

  it("reads a plugin's rule in the full DSL, under the plugin's name", () => {
    const detect = (): readonly { start: number }[] => [];
    const exported = { apiVersion: API_VERSION, name: "house", rules: [{ ...FULL, type: undefined, words: undefined, detect }] };
    const read = parsePlugin(exported, { written: "chaff-plugin-house", file: "/p/index.js", expectedName: "house" }, ["business", "blog"]);
    assert.deepEqual(read.problems, []);
    const [rule] = read.plugin?.rules ?? [];
    assert.equal(rule?.id, "house/no-tbd");
    assert.equal(rule?.guide?.group, "slips");
    assert.deepEqual(rule?.use_for, ["business"]);
  });

  it("refuses a plugin's rule with a bad field, naming the plugin", () => {
    const detect = (): readonly { start: number }[] => [];
    const exported = { apiVersion: API_VERSION, name: "house", rules: [{ ...OLD_STYLE, type: undefined, words: undefined, group: "misc", detect }] };
    const read = parsePlugin(exported, { written: "chaff-plugin-house", file: "/p/index.js", expectedName: "house" }, ["business"]);
    assert.equal(read.plugin, undefined);
    assert.deepEqual(
      read.problems.map((problem) => ("problem" in problem ? problem.problem.kind : problem.kind)),
      ["bad-group"],
    );
  });
});

describe("rule DSL — on the command line", () => {
  const CONFIG = [
    "custom_rules:",
    "  - id: no-tbd",
    "    type: words",
    "    words: [TBD]",
    "    name: { ja: TBD が残っている, en: TBD left in }",
    "    why: { ja: 読み手が動けません。, en: A reader cannot act on it. }",
    "    how_to_fix: { ja: 決めたことを書きます。, en: Write what was decided. }",
    "    levels: { strict: error, normal: warning, relaxed: info }",
    "    use_for: [business]",
    "    group: slips",
    "    example:",
    "      en: { before: Due TBD., after: Due 1 May. }",
    "",
  ].join("\n");
  const DOC = "# Plan\n\nThe launch is due TBD.\n";

  it("runs in a genre its use_for names and says it did not run in another", async () => {
    const report = await runCli({ "chaff.yaml": CONFIG, "doc.md": DOC }, ["doc.md", "--genre", "business/report", "--compact"], "en_US.UTF-8");
    assert.match(report.out, /no-tbd/u);
    const blog = await runCli({ "chaff.yaml": CONFIG, "doc.md": DOC }, ["doc.md", "--genre", "blog/tech"], "en_US.UTF-8");
    assert.match(blog.out, /no-tbd \(the blog\/tech genre does not check it\)/u);
  });

  it("stops the run on a bad field and says which", async () => {
    const run = await runCli({ "chaff.yaml": CONFIG.replace("group: slips", "group: misc"), "doc.md": DOC }, ["doc.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /custom_rules no-tbd: group: misc is not a group/u);
  });
});
