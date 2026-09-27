import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../packages/chaff/src/config/load.ts";
import { ruleProblems } from "../packages/chaff/src/config/rule-problems.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { rulesJson } from "../packages/chaff/src/render/rules-json.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 段階の 4 語では足りないときに、rule の上限を数値で書ける。書いたのに効いていない設定は黙って捨てない。

const configFrom = (yaml: string) => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-config-"));
  const path = join(dir, "chaff.yaml");
  writeFileSync(path, yaml);
  return loadConfig(path);
};

const RULES = loadRules("ja");
const KNOWN = RULES.map((rule) => rule.id);

describe("rules written as numbers", () => {
  it("reads a positive number as normal, with that limit", () => {
    const config = configFrom("rules:\n  max-sentence-length: 260\n  bold-density: relaxed\n");
    assert.deepEqual(config.rules, { "max-sentence-length": "normal", "bold-density": "relaxed" });
    assert.deepEqual(config.limits, { "max-sentence-length": 260 });
    assert.deepEqual(config.unreadableRules, []);
  });

  const unreadable: readonly (readonly [string, string])[] = [
    ["zero", "0"],
    ["a negative number", "-5"],
    ["a misspelt level", "strcit"],
    ["a list", "[1, 2]"],
    ["true", "true"],
  ];
  unreadable.forEach(([label, value]) => {
    it(`keeps ${label} as a problem instead of dropping it`, () => {
      const config = configFrom(`rules:\n  max-sentence-length: ${value}\n`);
      assert.deepEqual(config.rules, {});
      assert.deepEqual(config.limits, {});
      assert.equal(config.unreadableRules.length, 1);
      assert.equal(config.unreadableRules[0]?.id, "max-sentence-length");
    });
  });
});

describe("ruleProblems", () => {
  it("says nothing when every setting is a known rule with a readable value", () => {
    assert.deepEqual(ruleProblems(configFrom("rules:\n  max-sentence-length: 200\n  bold-density: off\n"), KNOWN), []);
  });

  it("names a rule chaff does not have, however it was written", () => {
    const problems = ruleProblems(configFrom("rules:\n  max-sentense-length: relaxed\n  bold-densty: 30\n  heading-ecko: maybe\n"), KNOWN);
    assert.equal(problems.length, 3);
    ["max-sentense-length", "bold-densty", "heading-ecko"].forEach((id) =>
      assert.ok(
        problems.some((problem) => problem.includes(`${id} というルールはありません`)),
        id,
      ),
    );
  });

  it("names an unreadable value on a rule it knows", () => {
    const problems = ruleProblems(configFrom("rules:\n  max-sentence-length: strcit\n"), KNOWN);
    assert.deepEqual(problems.length, 1);
    assert.ok(problems[0]?.includes('max-sentence-length の値 "strcit" は読めません'));
  });
});

describe("a numeric limit decides what is reported", () => {
  // 一文 200 字ほどの文。relaxed（140 字）では長すぎ、上限 250 なら通る。
  const LONG = `${"設定の手順は画面の右上にあるボタンを押してから開く一覧の中で目的の項目を選び、".repeat(5)}保存します。`;
  const findingsWith = (yaml: string): string[] => {
    const config = configFrom(yaml);
    const doc = buildDocument("a.md", `# 手順\n\n${LONG}\n`, ja);
    return runRules(doc, RULES, config.rules, false, "technical/readme", config.limits)
      .findings.map((finding) => finding.rule)
      .filter((id) => id === "max-sentence-length");
  };

  it("the sentence is over the relaxed level", () => {
    assert.ok(LONG.length > 140 && LONG.length < 250, String(LONG.length));
    assert.deepEqual(findingsWith("rules:\n  max-sentence-length: relaxed\n"), ["max-sentence-length"]);
  });

  it("passes under a limit above its length", () => {
    assert.deepEqual(findingsWith("rules:\n  max-sentence-length: 250\n"), []);
  });

  it("is reported under a limit below its length", () => {
    assert.deepEqual(findingsWith("rules:\n  max-sentence-length: 150\n"), ["max-sentence-length"]);
  });
});

describe("rules --json shows the limit in effect", () => {
  it("reports the number and where it came from", () => {
    const config = configFrom("genre: technical/readme\nlanguage: ja\nrules:\n  max-sentence-length: 260\n");
    const parsed: unknown = JSON.parse(rulesJson(RULES, config, "ja", "technical/readme"));
    const rules = typeof parsed === "object" && parsed !== null && "rules" in parsed && Array.isArray(parsed.rules) ? parsed.rules : [];
    const rule: unknown = rules.find((entry: unknown) => typeof entry === "object" && entry !== null && "id" in entry && entry.id === "max-sentence-length");
    assert.ok(typeof rule === "object" && rule !== null);
    assert.deepEqual("now" in rule ? rule.now : undefined, { level: "normal", limit: 260, set_as: "number" });
    assert.deepEqual("your_setting" in rule ? rule.your_setting : undefined, { level: "normal", limit: 260, from: config.path });
  });
});
