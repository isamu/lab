import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { sectionOpeners } from "../packages/chaff/src/detectors/gram-openers.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { Section, Sentence } from "../packages/chaff/src/plugin.ts";

// ngram-repetition: a reference document opens each section with the same formula (「…によると以下の制約である。」). A
// phrase found only in sections' first sentences is the sections' template, not the writer repeating. Self-written text.

const sentence = (text: string, start: number): Sentence => ({ span: { start, end: start + text.length }, text });
const section = (depth: number, texts: readonly string[], start: number): Pick<Section, "depth" | "sentences"> => ({
  depth,
  sentences: texts.map((text, index) => sentence(text, start + index * 10)),
});

describe("sectionOpeners", () => {
  it("is the first sentence of each headed section, not of the introduction", () => {
    const sections = [section(0, ["前置き。"], 0), section(2, ["一。", "二。"], 100), section(3, [], 200), section(2, ["三。"], 300)];
    assert.deepEqual(
      [...sectionOpeners(sections)].map((each) => each.text),
      ["一。", "三。"],
    );
  });
});

const RESOURCES = ["関数", "データベース", "バケット", "ストリーム", "キュー", "トピック", "テーブル", "ロール"];
const filler = Array.from({ length: 30 }, (_, index) => `項目${String(index)}の値${String(index)}。`).join("");
const FORMULA = "公式の資料によると以下の制約である。";

const worst = (source: string): string | undefined => {
  const finding = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "technical/spec").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

describe("ngram-repetition: a formula that opens each section", () => {
  it("does not count a phrase that only opens sections", async () => {
    await ja.prepare?.({ pos: true });
    const body = RESOURCES.map((name, index) => `## ${name}\n\n${FORMULA}\n\n- 長さは ${String(index + 3)} 文字まで`).join("\n\n");
    assert.equal(worst(`# 命名の制約\n\n${filler}\n\n${body}\n`), undefined);
  });

  it("still counts the same phrase when it also stands later in a section", async () => {
    await ja.prepare?.({ pos: true });
    const body = RESOURCES.map((name, index) => `## ${name}\n\n名前は短くする。${FORMULA}\n\n- 長さは ${String(index + 3)} 文字まで`).join("\n\n");
    assert.match(worst(`# 命名の制約\n\n${filler}\n\n${body}\n`) ?? "", /資料|制約|以下/u);
  });
});
