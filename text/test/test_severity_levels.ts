import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules, type Settings } from "../packages/chaff/src/run.ts";
import { definedLevels, severityAt } from "../packages/chaff/src/levels.ts";
import { applyLevel } from "../packages/chaff/src/config/write.ts";
import { loadConfig } from "../packages/chaff/src/config/read.ts";
import { ruleProblems } from "../packages/chaff/src/config/rule-problems.ts";
import { renderExplain } from "../packages/chaff/src/render/explain.ts";
import { rulesJson } from "../packages/chaff/src/render/rules-json.ts";
import { evaluate } from "../packages/chaff/src/eval.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import type { RuleDefinition, Severity } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

// A rule with no numeric limit (a missing article, a date and a weekday that disagree) cannot count more or fewer.
// Its levels set how a finding is marked, so relax keeps the finding visible and lowers it a step.

const RULES_JA = loadRules("ja");
const RULES_EN = loadRules("en");

const ruleOf = (id: string, rules: readonly RuleDefinition[] = RULES_JA): RuleDefinition => {
  const rule = rules.find((entry) => entry.id === id);
  assert.ok(rule, `${id} is not loaded`);
  return rule;
};

const NO_LIMIT_ERRORS = ["numbering-gap", "dangling-reference", "date-weekday-mismatch", "total-mismatch"];
const NO_LIMIT_WARNINGS = ["duplicate-definition", "date-order", "doubled-word"];
const LOWER: Readonly<Record<Severity, Severity>> = { error: "warning", warning: "info", info: "info" };

const tmpConfig = (body?: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "chaff-severity-")), "chaff.yaml");
  if (body !== undefined) writeFileSync(path, body, "utf8");
  return path;
};

describe("a rule with no numeric limit sets severity with its levels", () => {
  [...NO_LIMIT_ERRORS, ...NO_LIMIT_WARNINGS].forEach((id) => {
    it(`${id}: relaxed lowers the severity one step and normal keeps it`, () => {
      const rule = ruleOf(id);
      assert.equal(rule.level_sets, "severity");
      assert.equal(severityAt(rule, "normal"), rule.severity);
      assert.equal(severityAt(rule, "relaxed"), LOWER[rule.severity]);
    });
  });

  NO_LIMIT_ERRORS.forEach((id) => {
    it(`${id}: has no strict, since nothing is above error`, () => {
      assert.deepEqual(definedLevels(ruleOf(id)), ["normal", "relaxed", "off"]);
    });
  });

  NO_LIMIT_WARNINGS.forEach((id) => {
    it(`${id}: strict raises it to error`, () => {
      assert.equal(severityAt(ruleOf(id), "strict"), "error");
    });
  });

  it("reads the L4 rules' severity levels the same way", () => {
    const risk = ruleOf("risk-disclosure");
    assert.equal(risk.level_sets, "severity");
    assert.deepEqual(
      (["strict", "normal", "relaxed"] as const).map((level) => severityAt(risk, level)),
      ["error", "warning", "info"],
    );
  });

  it("keeps a counting rule on limits", () => {
    assert.equal(ruleOf("bold-density").level_sets, "limit");
    assert.equal(ruleOf("max-sentence-length", RULES_EN).level_sets, "limit");
  });

  [RULES_JA, RULES_EN].forEach((rules, index) => {
    it(`no counting rule has levels that all say the same (${index === 0 ? "ja" : "en"})`, () => {
      // Levels that are all one number do nothing: relax and strict would change the file and not the result.
      const inert = rules
        .filter((rule) => rule.level_sets === "limit")
        .filter((rule) => new Set(Object.values(rule.levels)).size < 2)
        .map((rule) => rule.id);
      assert.deepEqual(inert, []);
    });
  });
});

describe("the rule loader", () => {
  const ruleFile = (levels: string, severity: string): string =>
    [
      "id: sample",
      "layer: L3",
      "status: stable",
      `severity: ${severity}`,
      "name: { ja: 見本, en: Sample }",
      "why: { ja: 理由, en: Why }",
      "how_to_fix: { ja: 直す, en: Fix }",
      "message: { ja: 見本, en: Sample }",
      `levels: ${levels}`,
      "how_to_find: numbering-gap",
      "use_for: [business]",
      "",
    ].join("\n");
  const loadOne = (levels: string, severity: string): RuleDefinition[] => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-rules-"));
    writeFileSync(join(dir, "sample.yaml"), ruleFile(levels, severity), "utf8");
    return loadRules("ja", dir);
  };

  it("refuses a severity that is not the one at normal", () => {
    assert.throws(() => loadOne("{ normal: error, relaxed: warning }", "warning"), /sample\.yaml/u);
  });

  it("refuses levels that mix severities and numbers", () => {
    assert.throws(() => loadOne("{ normal: error, relaxed: 2 }", "error"), /sample\.yaml/u);
  });

  it("refuses a genre table of numbers under severity levels", () => {
    assert.throws(() => loadOne("{ normal: error, relaxed: warning }\nby_genre:\n  legal: { normal: 1, relaxed: warning }", "error"), /sample\.yaml/u);
  });

  it("refuses a genre table under severity levels, which would move the default severity", () => {
    assert.throws(() => loadOne("{ normal: error, relaxed: warning }\nby_genre:\n  legal: { normal: info, relaxed: info }", "error"), /sample\.yaml/u);
  });

  it("refuses severities in a genre table of a counting rule", () => {
    assert.throws(() => loadOne("{ normal: 3, relaxed: 5 }\nby_genre:\n  legal: { normal: error }", "error"), /sample\.yaml/u);
  });

  it("loads severity levels that agree with the severity", () => {
    assert.equal(loadOne("{ normal: error, relaxed: warning }", "error")[0]?.level_sets, "severity");
  });
});

const statuteJa = loadProfiles().find((definition) => definition.id === "statute")?.languages["ja"];
const GAP = ["第1条（目的）", "本文。", "第3条（義務）", "本文。"].join("\n");
const TWICE = ["第1条（定義）", "「本件」とは、甲の業務をいう。", "第2条（再定義）", "「本件」とは、乙の業務をいう。"].join("\n");

const severitiesOf = (source: string, id: string, settings: Settings): Severity[] =>
  runRules(buildDocument("c.txt", source, ja, undefined, statuteJa), RULES_JA, settings, true, "business/contract")
    .findings.filter((finding) => finding.rule === id)
    .map((finding) => finding.severity);

describe("a run marks the finding at the level set", () => {
  it("numbering-gap: an error at normal, a warning when relaxed", () => {
    assert.deepEqual(severitiesOf(GAP, "numbering-gap", {}), ["error"]);
    assert.deepEqual(severitiesOf(GAP, "numbering-gap", { "numbering-gap": "relaxed" }), ["warning"]);
  });

  it("duplicate-definition: a warning at normal, a note when relaxed, an error when strict", () => {
    assert.deepEqual(severitiesOf(TWICE, "duplicate-definition", {}), ["warning"]);
    assert.deepEqual(severitiesOf(TWICE, "duplicate-definition", { "duplicate-definition": "relaxed" }), ["info"]);
    assert.deepEqual(severitiesOf(TWICE, "duplicate-definition", { "duplicate-definition": "strict" }), ["error"]);
  });

  it("a counting rule keeps its severity at every level", () => {
    const long = `${"あ".repeat(300)}。`;
    const severity = RULES_JA.find((rule) => rule.id === "max-sentence-length")?.severity;
    const at = (level: Settings[string]): Severity[] =>
      runRules(buildDocument("a.md", `# T\n\n${long}\n`, ja), RULES_JA, { "max-sentence-length": level }, true, "business/report")
        .findings.filter((finding) => finding.rule === "max-sentence-length")
        .map((finding) => finding.severity);
    assert.deepEqual(at("strict"), [severity]);
    assert.deepEqual(at("normal"), [severity]);
  });
});

describe("relax and strict say what they did", () => {
  it("relax on an error rule says the finding stays, as a warning", () => {
    const ja1 = applyLevel(tmpConfig(), ruleOf("numbering-gap"), "relaxed", "欠番を残す規程のため", "ja", "isamu");
    assert.equal(ja1.ok, true);
    assert.match(ja1.message, /エラー ではなく 注意/u);
    const en1 = applyLevel(tmpConfig(), ruleOf("numbering-gap", RULES_EN), "relaxed", "numbers are kept", "en", "isamu");
    assert.match(en1.message, /as a warning instead of an error/u);
  });

  it("strict on a warning rule says it becomes an error", () => {
    const outcome = applyLevel(tmpConfig(), ruleOf("duplicate-definition", RULES_EN), "strict", "one definition each", "en", "isamu");
    assert.match(outcome.message, /as an error instead of a warning/u);
  });

  it("strict on an error rule changes nothing and says so", () => {
    const path = tmpConfig();
    const outcome = applyLevel(path, ruleOf("numbering-gap"), "strict", "きびしく", "ja", "isamu");
    assert.equal(outcome.ok, false);
    assert.match(outcome.message, /normal と同じ/u);
  });

  it("a level at the same severity as normal says nothing about severity", () => {
    const outcome = applyLevel(tmpConfig(), ruleOf("numbering-gap"), "normal", "既定に戻す", "ja", "isamu");
    assert.equal(outcome.ok, true);
    assert.doesNotMatch(outcome.message, /ではなく/u);
  });

  it("off says nothing about severity", () => {
    const outcome = applyLevel(tmpConfig(), ruleOf("numbering-gap"), "off", "見ない", "ja", "isamu");
    assert.doesNotMatch(outcome.message, /ではなく/u);
  });

  it("relax on a counting rule says nothing about severity", () => {
    const outcome = applyLevel(tmpConfig(), ruleOf("bold-density"), "relaxed", "図が多い", "ja", "isamu");
    assert.doesNotMatch(outcome.message, /注意|エラー/u);
  });
});

describe("explain and rules --json show severities, not a limit", () => {
  it("explain lists the severity at each level, in both languages", () => {
    const text = renderExplain(ruleOf("numbering-gap"), "relaxed", "ja");
    assert.match(text, /指摘の重さ/u);
    assert.match(text, /normal +エラー/u);
    assert.match(text, /→ relaxed +注意/u);
    assert.doesNotMatch(text, /回/u);
    const en = renderExplain(ruleOf("duplicate-definition", RULES_EN), "normal", "en");
    assert.match(en, /strict +error/u);
    assert.match(en, /→ normal +warning/u);
    assert.match(en, /relaxed +note/u);
  });

  const entryOf = (json: string, id: string): Record<string, unknown> => {
    const parsed: unknown = JSON.parse(json);
    const rules: unknown = typeof parsed === "object" && parsed !== null && "rules" in parsed ? parsed.rules : [];
    const found: unknown = Array.isArray(rules)
      ? rules.find((entry: unknown) => typeof entry === "object" && entry !== null && "id" in entry && entry.id === id)
      : undefined;
    assert.ok(typeof found === "object" && found !== null, `${id} is not in rules --json`);
    return Object.fromEntries(Object.entries(found));
  };

  it("rules --json names severities and says the levels set them", () => {
    const config = loadConfig(tmpConfig("rules:\n  numbering-gap: relaxed\n"));
    const entry = entryOf(rulesJson(RULES_JA, config, "ja", "business/contract"), "numbering-gap");
    assert.equal(entry["level_sets"], "severity");
    assert.deepEqual(entry["levels"], { normal: "error", relaxed: "warning" });
    assert.deepEqual(entry["now"], { level: "relaxed", severity: "warning" });
    assert.deepEqual(entry["levels_you_can_set"], ["normal", "relaxed", "off"]);
  });

  it("rules --json keeps limits for a counting rule", () => {
    const config = loadConfig(tmpConfig("rules:\n  bold-density: relaxed\n"));
    const entry = entryOf(rulesJson(RULES_JA, config, "ja", "business/report"), "bold-density");
    assert.equal(entry["level_sets"], "limit");
    assert.deepEqual(entry["now"], { level: "relaxed", limit: 40 });
  });
});

describe("a number written for a rule with no limit", () => {
  it("is reported, in both languages", () => {
    const config = loadConfig(tmpConfig("rules:\n  numbering-gap: 3\n"));
    const problems = ruleProblems(config, RULES_JA, "ja");
    assert.ok(
      problems.some((problem) => problem.includes("numbering-gap には数の上限がありません")),
      problems.join("\n"),
    );
    const en = ruleProblems(config, RULES_EN, "en");
    assert.ok(
      en.some((problem) => problem.includes("numbering-gap has no numeric limit")),
      en.join("\n"),
    );
  });
});

describe("chaff eval", () => {
  it("does not sweep a rule with no limit", () => {
    const docs = [buildDocument("c.txt", GAP, ja, undefined, statuteJa)];
    const reports = evaluate(docs, [ruleOf("numbering-gap")], "business/contract", "ja");
    assert.deepEqual(reports, []);
  });
});

describe("the command line", () => {
  it("after relax, the gap still shows, as a warning, and the run passes", async () => {
    const files = { "a.md": `# 規程\n\n${GAP.replaceAll("\n", "\n\n")}\n`, "chaff.yaml": "experimental: true\n" };
    const before = await runCli(files, ["a.md"]);
    assert.equal(before.code, 1, before.out);
    assert.match(before.out, /番号の抜け/u);
    const relaxed = await runCli({ ...files, "chaff.yaml": "experimental: true\nrules:\n  numbering-gap: relaxed\n" }, ["a.md"]);
    assert.equal(relaxed.code, 0, relaxed.out);
    assert.match(relaxed.out, /番号の抜け/u);
    assert.match(relaxed.out, /注意 1 件/u);
    assert.equal(readFileSync(join(relaxed.dir, "chaff.yaml"), "utf8").includes("relaxed"), true);
  });
});
