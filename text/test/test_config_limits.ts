import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../packages/chaff/src/config/load.ts";
import { ruleProblems } from "../packages/chaff/src/config/rule-problems.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules, type Settings } from "../packages/chaff/src/run.ts";
import { rulesJson } from "../packages/chaff/src/render/rules-json.ts";
import { evaluate } from "../packages/chaff/src/eval.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { runCli, type CliRun } from "./cli-run.ts";

// 段階の 4 語では足りないときに、rule の上限を数値で書ける。書いたのに効いていない設定は黙って捨てない。

const configFrom = (yaml: string) => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-config-"));
  const path = join(dir, "chaff.yaml");
  writeFileSync(path, yaml);
  return loadConfig(path);
};

const RULES = loadRules("ja");

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
    assert.deepEqual(ruleProblems(configFrom("rules:\n  max-sentence-length: 200\n  bold-density: off\n"), RULES), []);
  });

  it("names a rule chaff does not have, however it was written", () => {
    const problems = ruleProblems(configFrom("rules:\n  max-sentense-length: relaxed\n  bold-densty: 30\n  heading-ecko: maybe\n"), RULES);
    assert.equal(problems.length, 3);
    ["max-sentense-length", "bold-densty", "heading-ecko"].forEach((id) =>
      assert.ok(
        problems.some((problem) => problem.includes(`${id} というルールはありません`)),
        id,
      ),
    );
  });

  it("names an unreadable value on a rule it knows", () => {
    const problems = ruleProblems(configFrom("rules:\n  max-sentence-length: strcit\n"), RULES);
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

describe("through the CLI", () => {
  const LONG_SENTENCE = `${"設定の手順は画面の右上にあるボタンを押してから開く一覧の中で目的の項目を選び、".repeat(5)}保存します。`;
  const lintIn = async (yaml: string): Promise<CliRun> => runCli({ "chaff.yaml": yaml, "a.md": `# 手順\n\n${LONG_SENTENCE}\n` }, ["a.md", "--compact"]);

  it("passes the numeric limit to the run", async () => {
    const loose = await lintIn("genre: technical/readme\nlanguage: ja\nrules:\n  max-sentence-length: 250\n");
    const tight = await lintIn("genre: technical/readme\nlanguage: ja\nrules:\n  max-sentence-length: 150\n");
    assert.ok(!loose.out.includes("文が長"), loose.out);
    assert.notEqual(loose.out, tight.out);
  });

  it("warns on stderr about a misspelt rule, and still lints", async () => {
    const result = await lintIn("genre: technical/readme\nlanguage: ja\nrules:\n  max-sentense-length: 250\n");
    assert.ok(result.err.includes("max-sentense-length というルールはありません"), result.err);
    assert.ok(result.out.includes("a.md"), result.out);
  });
});

describe("a numeric limit on a composite rule", () => {
  // 材料の 2 本（文の長さ・段落の長さ）は上限を小さくして必ず出す。合成の rule は「何本出たら」を上限に持つ。
  const base = RULES.find((rule) => rule.id === "max-sentence-length");
  if (base === undefined) throw new Error("max-sentence-length is missing");
  const composite = { ...base, id: "both-long", how_to_find: "", from: ["max-sentence-length", "max-paragraph-length"], levels: { normal: 2 } };
  const compositesWith = (limit: number): number => {
    const doc = buildDocument(
      "a.md",
      "# 手順\n\n画面の右上にある設定を開いて、通知の項目を一覧から選びます。選んだ項目の内容を確かめてから、画面の下にある保存を押します。保存が終わると、画面の上に完了の知らせが出ます。\n",
      ja,
    );
    const limits = { "max-sentence-length": 3, "max-paragraph-length": 1, "both-long": limit };
    const settings: Settings = { "max-sentence-length": "normal", "max-paragraph-length": "normal", "both-long": "normal" };
    return runRules(doc, [...RULES, composite], settings, false, "technical/readme", limits).findings.filter((finding) => finding.rule === "both-long").length;
  };

  it("fires when as many rules fired as the number asks", () => {
    assert.equal(compositesWith(2), 1);
  });

  it("stays quiet when the number asks for more", () => {
    assert.equal(compositesWith(3), 0);
  });
});

describe("a number on a rule that reads meaning (L4)", () => {
  const semantic = RULES.find((rule) => rule.layer === "L4");
  if (semantic === undefined) throw new Error("no L4 rule to test with");

  it("is reported, since such a rule has no threshold", () => {
    const problems = ruleProblems(configFrom(`rules:\n  ${semantic.id}: 3\n`), RULES);
    assert.ok(
      problems.some((problem) => problem.includes(`${semantic.id} は意味を読む検査なので数値の上限はありません`)),
      problems.join("\n"),
    );
  });

  it("is not shown as a limit by rules --json", () => {
    const config = configFrom(`rules:\n  ${semantic.id}: 3\n`);
    const parsed: unknown = JSON.parse(rulesJson(RULES, config, "ja", "business/proposal"));
    const rules = typeof parsed === "object" && parsed !== null && "rules" in parsed && Array.isArray(parsed.rules) ? parsed.rules : [];
    const rule: unknown = rules.find((entry: unknown) => typeof entry === "object" && entry !== null && "id" in entry && entry.id === semantic.id);
    assert.ok(typeof rule === "object" && rule !== null);
    const now: unknown = "now" in rule ? rule.now : undefined;
    assert.ok(typeof now === "object" && now !== null);
    assert.notEqual("limit" in now ? now.limit : undefined, 3);
    assert.equal("set_as" in now, false);
    assert.deepEqual("your_setting" in rule ? rule.your_setting : undefined, { level: "normal", from: config.path });
  });
});

describe("chaff eval measures from the limit in effect", () => {
  const docs = [buildDocument("a.md", "# 手順\n\n設定を開きます。項目を選びます。\n", ja)];
  const sentenceRule = RULES.filter((rule) => rule.id === "max-sentence-length");

  it("marks a numeric limit as current and sweeps it", () => {
    const [report] = evaluate(docs, sentenceRule, "technical/readme", "ja", { "max-sentence-length": 777 });
    assert.equal(report?.current, 777);
    assert.ok(report?.sweep.some((point) => point.limit === 777));
  });

  it("keeps normal as current without one", () => {
    const [report] = evaluate(docs, sentenceRule, "technical/readme", "ja");
    assert.equal(report?.current, sentenceRule[0]?.levels.normal);
  });
});
