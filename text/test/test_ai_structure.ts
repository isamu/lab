import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules, type Settings } from "../packages/chaff/src/run.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { aiStructure } from "../packages/chaff/src/detectors/ai-structure.ts";
import { templateSectionsOf } from "../packages/chaff/src/structure-shape/template-outline.ts";
import { headingWords } from "../packages/chaff/src/structure-shape/heading-words.ts";

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

/** A short proposal under the given headings: one paragraph each, and a list of bold-label items in the second. */
const proposal = (title: string, headings: readonly string[], sentence: string, labels: readonly string[]): string =>
  lines(
    `# ${title}`,
    "",
    ...headings.flatMap((heading, index) => [
      `## ${heading}`,
      "",
      sentence.repeat(index + 1),
      "",
      ...(index === 1 ? [...labels.map((label) => `- **${label}**: ${sentence}`), ""] : []),
    ]),
  );

const TEXTBOOK_EN = ["Summary", "Current Situation", "Proposed Solution", "Expected Benefits", "Costs", "Risks and Mitigation", "Next Steps"];
const OWN_EN = ["Where we are", "What hurts", "What I would try", "What it changes", "What it costs", "What could go wrong", "What I need from you"];
const SENTENCE_EN = "The team tracks its work in a shared sheet that nobody keeps up to date. ";
const LABELS_EN = ["Ownership", "Status", "Deadlines"];

const TEXTBOOK_JA = ["提案の背景", "現状の課題", "提案内容", "期待される効果", "費用", "リスクと対策", "今後の進め方"];
const OWN_JA = ["困っていること", "試したいこと", "変わること", "かかるお金", "心配なこと", "お願いしたいこと", "次に決めること"];
const SENTENCE_JA = "請求書は紙で受け取り、毎月の締めに三日かかっています。";
const LABELS_JA = ["担当", "状況", "期限"];

const englishWords = (headings: readonly string[]): string[] => headings.map((heading) => headingWords(heading));

describe("templateSectionsOf: the sections of a textbook proposal outline", () => {
  const lexiconOf = (adapter: LanguageAdapter) => adapter.lexicons["template-heading"] ?? [];

  it("names each section once, in heading order", () => {
    assert.deepEqual(templateSectionsOf(englishWords(TEXTBOOK_EN), lexiconOf(en)), ["summary", "background", "proposal", "benefits", "costs", "risks", "next"]);
  });

  it("does not read a longer compound as the section: 効果測定, 提案者, 費用対効果", () => {
    assert.deepEqual(templateSectionsOf(["効果測定の方法", "提案者の紹介", "費用対効果", "リスク管理表"], lexiconOf(ja)), []);
    assert.deepEqual(templateSectionsOf(["効果", "提案（案）", "費用について"], lexiconOf(ja)), ["benefits", "proposal", "costs"]);
  });

  it("reads a heading by its longest entry: 提案の背景 is the background, not the proposal", () => {
    assert.deepEqual(templateSectionsOf(["提案の背景"], lexiconOf(ja)), ["background"]);
  });

  it("matches whole words after the number, and counts a section once however often it stands", () => {
    assert.deepEqual(templateSectionsOf(englishWords(["1. Costs", "Costs (continued)", "Costing model", "Summary"]), lexiconOf(en)), ["costs", "summary"]);
  });

  it("finds nothing in headings of the writer's own words, or without a lexicon", () => {
    assert.deepEqual(templateSectionsOf(englishWords(OWN_EN), lexiconOf(en)), []);
    assert.deepEqual(templateSectionsOf(englishWords(TEXTBOOK_EN), []), []);
  });
});

describe("ai-structure in business documents", () => {
  it("counts the textbook outline as one more measure, so a proposal reaches the normal level", () => {
    const [finding] = ofRule(run(en, proposal("Proposal", TEXTBOOK_EN, SENTENCE_EN, LABELS_EN), {}, "business/proposal"), "ai-structure");
    assert.equal(finding?.values["count"], 3);
    assert.match(String(finding?.values["word"] ?? ""), /textbook proposal or report headings/u);
  });

  it("counts it in Japanese too", () => {
    const [finding] = ofRule(run(ja, proposal("提案", TEXTBOOK_JA, SENTENCE_JA, LABELS_JA), {}, "business/proposal"), "ai-structure");
    assert.match(String(finding?.values["word"] ?? ""), /定型の見出し/u);
  });

  it("stays quiet on the same proposal under the writer's own headings", () => {
    assert.deepEqual(ofRule(run(en, proposal("Proposal", OWN_EN, SENTENCE_EN, LABELS_EN), {}, "business/proposal"), "ai-structure"), []);
    assert.deepEqual(ofRule(run(ja, proposal("提案", OWN_JA, SENTENCE_JA, LABELS_JA), {}, "business/proposal"), "ai-structure"), []);
  });

  it("stays quiet when only three template sections stand, as in a real proposal", () => {
    const three = [...TEXTBOOK_EN.slice(0, 3), ...OWN_EN.slice(3)];
    assert.deepEqual(ofRule(run(en, proposal("Proposal", three, SENTENCE_EN, LABELS_EN), {}, "business/proposal"), "ai-structure"), []);
  });

  it("stays quiet on a textbook outline with nothing else past the human articles", () => {
    const plain = proposal("Proposal", TEXTBOOK_EN, SENTENCE_EN.repeat(6), []);
    assert.deepEqual(ofRule(run(en, plain, {}, "business/proposal"), "ai-structure"), []);
  });
});
