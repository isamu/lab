import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules, type Settings } from "../packages/chaff/src/run.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { aiStructure } from "../packages/chaff/src/detectors/ai-structure.ts";

// ai-structure: several structure measures past 90% of human articles at once, the document-level rule over chaff
// outline's structure block. Every text here is written for the test.

const lines = (...rows: string[]): string => rows.join("\n");

/** Sections of very different lengths, so the section lengths are not uniform. */
const LENGTHS = [1, 4, 12];

const threeWay = (heading: string, children: readonly string[], sentence = "書きます。"): string[] => [
  `## ${heading}`,
  "",
  ...children.flatMap((child, index) => [`### ${child}`, "", sentence.repeat(LENGTHS[index] ?? 1), ""]),
];

/** Two headings split into three, and two bold-label items: two measures past the human limit. */
const SPLIT = lines(
  "# 勉強会を見直す",
  "",
  ...threeWay("課題", ["人が減った", "話す人が偏った", "題材が遠かった"]),
  ...threeWay("対策", ["題材を選ぶ", "短く話す", "記録を残す"]),
  "## 学んだこと",
  "",
  "- **仕組み**：意志だけでは続きません",
  "- **小ささ**：短い発表なら誰でも話せます",
);

const FOLDED = lines("# 勉強会は、発表を短くしたら人が戻った", "", "来る人が減りました。", "", "## 短く話す", "", "発表を五分にしました。");

const run = (adapter: LanguageAdapter, source: string, settings: Settings, genre = "blog/tech"): readonly Finding[] =>
  runRules(buildDocument("a.md", source, adapter), loadRules(adapter.id), settings, true, genre).findings;

const ofRule = (findings: readonly Finding[], rule: string): Finding[] => findings.filter((finding) => finding.rule === rule);

describe("ai-structure", () => {
  it("fires once the measures past the human limit reach the level's count, naming them, at the first section heading", () => {
    const [finding, ...rest] = ofRule(run(ja, SPLIT, { "ai-structure": "strict" }), "ai-structure");
    assert.equal(rest.length, 0);
    assert.equal(finding?.values["count"], 2);
    assert.equal(finding?.values["limit"], 2);
    assert.equal(finding?.values["word"], "3 つの小見出しに分けた見出し、太字の見出しで始まる項目");
    assert.equal(finding?.quote, "課題");
    assert.equal(finding?.line, 3);
  });

  it("stays quiet below the count: two measures do not reach the normal level", () => {
    assert.deepEqual(ofRule(run(ja, SPLIT, {}), "ai-structure"), []);
  });

  it("stays quiet on a folded outline", () => {
    assert.deepEqual(ofRule(run(ja, FOLDED, { "ai-structure": "strict" }), "ai-structure"), []);
  });

  it("feeds ai-generated-composite as one of its signals", () => {
    const composite = loadRules("ja").find((rule) => rule.id === "ai-generated-composite");
    assert.ok(composite?.from.includes("ai-structure"));
  });

  it("does not run on a document without headings, and says why", () => {
    const result = runRules(buildDocument("a.md", "見出しの無い文書です。", ja), loadRules("ja"), { "ai-structure": "strict" }, true, "blog/tech");
    assert.ok(result.skipped.some((skipped) => skipped.rule === "ai-structure"));
  });

  it("does not run in a genre whose headings work differently from the blog baseline", () => {
    const result = runRules(buildDocument("a.md", SPLIT, ja), loadRules("ja"), {}, true, "docs/manual");
    assert.ok(result.skipped.some((skipped) => skipped.rule === "ai-structure"));
  });

  it("names the measures in English for an English document", () => {
    const english = lines(
      "# Demo",
      "",
      ...threeWay("Challenges", ["Attendance", "Speakers", "Topics"], "It is written here. "),
      ...threeWay("Solutions", ["Topics", "Length", "Notes"], "It is written here. "),
      "## Lessons",
      "",
      "- **Systems**: willpower does not last",
      "- **Small steps**: anyone can give a short talk",
    );
    const found = aiStructure(buildDocument("a.md", english, en), { limit: 2 });
    assert.match(String(found[0]?.values["word"] ?? ""), /headings split into three/u);
  });
});
