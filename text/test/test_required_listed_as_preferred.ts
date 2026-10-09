import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { requiredListedAsPreferred, type RequirementBlock, type RequirementWords } from "../packages/chaff/src/structure/requirement-lists.ts";

// 必須の条件を歓迎の条件にも挙げている（required-listed-as-preferred）。

const RULE = "required-listed-as-preferred";

const found = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/press-release")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${finding.line}:${String(finding.values["item"])}`);

const posting = (required: readonly string[], preferred: readonly string[], heads: readonly [string, string] = ["## Required", "## Preferred"]): string =>
  ["# Posting", "", heads[0], "", ...required.map((item) => `- ${item}`), "", heads[1], "", ...preferred.map((item) => `- ${item}`), ""].join("\n");

const line = (required: readonly string[]): number => 8 + required.length;

describe("required-listed-as-preferred, Japanese", () => {
  const heads: [string, string] = ["## 必須", "## 歓迎"];

  it("the same item in both lists is reported where it is preferred", () => {
    const required = ["日商簿記2級以上", "経理の実務経験3年以上"];
    assert.deepEqual(found(posting(required, ["英語", "日商簿記2級以上"], heads), ja), [`${line(required) + 1}:日商簿記2級以上`]);
  });

  it("width, case, punctuation and an item's ending do not matter", () => {
    assert.deepEqual(found(posting(["ＰＹＴＨＯＮの経験"], ["Pythonの経験がある方"], heads), ja), ["9:Pythonの経験がある方"]);
    assert.deepEqual(found(posting(["英語の書類を読めること"], ["英語の書類を読める方。"], heads), ja), ["9:英語の書類を読める方。"]);
  });

  it("a length of experience: reported unless the preferred one asks for more", () => {
    assert.deepEqual(found(posting(["Python 3年以上"], ["Python"], heads), ja), ["9:Python"]);
    assert.deepEqual(found(posting(["経理の実務経験3年以上"], ["3年以上の経理の実務経験"], heads), ja), ["9:3年以上の経理の実務経験"]);
    assert.deepEqual(found(posting(["Python"], ["Python 5年以上"], heads), ja), []);
    assert.deepEqual(found(posting(["Python 3年以上"], ["Python 5年以上"], heads), ja), []);
    assert.deepEqual(found(posting(["Python 1年以上"], ["Python 6か月以上"], heads), ja), ["9:Python 6か月以上"]);
  });

  it("different skills and different grades are not compared", () => {
    assert.deepEqual(found(posting(["日商簿記2級以上"], ["日商簿記1級", "連結決算の経験"], heads), ja), []);
  });

  it("headings with more words, a label standing alone and an inherited heading", () => {
    assert.deepEqual(found(posting(["Go"], ["Go"], ["## 必須スキル・経験", "## 歓迎スキル（あれば尚可）"]), ja), ["9:Go"]);
    assert.deepEqual(found(["# 求人", "", "## 応募の条件", "", "【必須】", "", "- Go", "", "**歓迎：**", "", "- Go", ""].join("\n"), ja), ["11:Go"]);
    assert.deepEqual(found(["# 求人", "", "## 応募資格", "", "### 技術", "", "- Go", "", "## 歓迎", "", "- Go", ""].join("\n"), ja), ["11:Go"]);
  });

  it("the preferred list may come first", () => {
    assert.deepEqual(found(posting(["Go"], ["Go"], ["## 歓迎", "## 必須"]), ja), ["5:Go"]);
  });

  it("lists without the two headings are not read", () => {
    assert.deepEqual(found(posting(["Go"], ["Go"], ["## 仕事の内容", "## 歓迎"]), ja), []);
    assert.deepEqual(found(["# 求人", "", "必須：Go", "", "- Go", "", "## 歓迎", "", "- Go", ""].join("\n"), ja), []);
  });
});

describe("required-listed-as-preferred, English", () => {
  it("the same item in both lists is reported where it is preferred", () => {
    const required = ["A degree in accounting", "At least three years of bookkeeping experience"];
    assert.deepEqual(found(posting(required, ["At least three years of bookkeeping experience", "Japanese"])), [
      `${line(required)}:At least three years of bookkeeping experience`,
    ]);
  });

  it("a length of experience: reported unless the preferred one asks for more", () => {
    assert.deepEqual(found(posting(["3+ years of Python"], ["Python"])), ["9:Python"]);
    assert.deepEqual(found(posting(["Python, 3 years or more"], ["Python (three years)"])), ["9:Python (three years)"]);
    assert.deepEqual(found(posting(["Python"], ["5+ years of Python"])), []);
    assert.deepEqual(found(posting(["At least 3 years of Python"], ["5 years of Python"])), []);
  });

  it("different skills are not compared, and an item's ending does not matter", () => {
    assert.deepEqual(found(posting(["Python"], ["Go", "Pythonic code"])), []);
    assert.deepEqual(found(posting(["Kubernetes"], ["Kubernetes is a plus"])), ["9:Kubernetes is a plus"]);
  });

  it("nested and labelled lists", () => {
    const nested = ["# Posting", "", "## Requirements", "", "### Required", "", "- SQL", "", "### Nice-to-have", "", "- sql", ""].join("\n");
    assert.deepEqual(found(nested), ["11:sql"]);
    const labelled = ["# Posting", "", "**Must have:**", "", "- SQL", "", "**Bonus points**", "", "- SQL", ""].join("\n");
    assert.deepEqual(found(labelled), ["9:SQL"]);
    assert.deepEqual(found(posting(["SQL"], ["SQL"], ["## Responsibilities", "## Preferred"])), []);
    assert.deepEqual(found(posting(["Referral form"], ["Referral form"], ["## Requirements", "## Bonus"])), []);
  });

  it("C++ and C# are different skills", () => {
    assert.deepEqual(found(posting(["C++"], ["C#", "C"])), []);
    assert.deepEqual(found(posting(["C#"], ["C#"])), ["9:C#"]);
  });

  it("an item wrapped onto the next line is read whole", () => {
    const wrapped = ["# Posting", "", "## Required", "", "- Python,", "  3+ years", "", "## Preferred", "", "- Python,", "  5+ years", ""].join("\n");
    assert.deepEqual(found(wrapped), []);
  });

  it("two postings in one document are compared each on its own", () => {
    const two = [
      "# Openings",
      "",
      "## Backend Engineer",
      "",
      "### Required",
      "",
      "- Python",
      "",
      "## Frontend Engineer",
      "",
      "### Required",
      "",
      "- TypeScript",
      "",
      "### Preferred",
      "",
      "- Python",
      "- TypeScript",
      "",
    ].join("\n");
    assert.deepEqual(found(two), ["18:TypeScript"]);
  });
});

const WORDS: RequirementWords = {
  required: ["必須"],
  preferred: ["歓迎"],
  units: [{ word: "年", value: 12 }],
  before: [],
  after: ["以上"],
  numbers: [],
  endings: [],
};

const heading = (text: string, offset: number, depth = 2): RequirementBlock => ({ kind: "heading", depth, text, offset });
const item = (text: string, offset: number): RequirementBlock => ({ kind: "item", text, offset });

describe("requiredListedAsPreferred", () => {
  it("nothing is read from no blocks or empty words", () => {
    assert.deepEqual(requiredListedAsPreferred([], WORDS), []);
    const blocks = [heading("必須", 0), item("Go", 1), heading("歓迎", 2), item("Go", 3)];
    assert.deepEqual(requiredListedAsPreferred(blocks, { ...WORDS, required: [], preferred: [] }), []);
    assert.deepEqual(requiredListedAsPreferred(blocks, WORDS), [{ offset: 3, values: { item: "Go", required: "Go" } }]);
  });

  it("an item that is only a length or punctuation names no skill", () => {
    const blocks = [heading("必須", 0), item("3年以上", 1), item("・", 2), heading("歓迎", 3), item("3年以上", 4), item("・", 5)];
    assert.deepEqual(requiredListedAsPreferred(blocks, WORDS), []);
  });

  it("a deeper heading without its own kind inherits; a shallower one closes the scope", () => {
    const blocks = [
      heading("必須", 0, 2),
      heading("言語", 1, 3),
      item("Go", 2),
      heading("その他", 3, 2),
      item("Rust", 4),
      heading("歓迎", 5, 2),
      item("Go", 6),
      item("Rust", 7),
    ];
    assert.deepEqual(requiredListedAsPreferred(blocks, WORDS), [{ offset: 6, values: { item: "Go", required: "Go" } }]);
  });

  it("a line that is not a label leaves the scope as it was", () => {
    const blocks: RequirementBlock[] = [
      heading("必須", 0),
      { kind: "line", text: "次の経験が要ります。", offset: 1 },
      item("Go", 2),
      heading("歓迎", 3),
      item("Go", 4),
    ];
    assert.deepEqual(requiredListedAsPreferred(blocks, WORDS), [{ offset: 4, values: { item: "Go", required: "Go" } }]);
  });
});
