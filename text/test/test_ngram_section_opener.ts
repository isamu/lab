import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { sectionOpeners } from "../packages/chaff/src/detectors/gram-openers.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// ngram-repetition: a reference document opens each section with the same sentence that leads into a list
// (「…によると以下の制約である。」 and the constraints below it). A phrase found only in those sentences is the sections'
// template, not the writer repeating (a pet phrase opening each section's prose is the bench's pet-phrase plant). Self-written text.

const RESOURCES = ["関数", "データベース", "バケット", "ストリーム", "キュー", "トピック", "テーブル", "ロール"];
const filler = Array.from({ length: 30 }, (_, index) => `項目${String(index)}の値${String(index)}。`).join("");
const FORMULA = "公式の資料によると以下の制約である。";

const worst = (source: string): string | undefined => {
  const finding = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, true, "technical/spec").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

describe("sectionOpeners", () => {
  it("is a headed section's first sentence that a list or a table follows, not one that prose follows", async () => {
    await ja.prepare?.({ pos: true });
    const source = [
      "前置き。",
      "",
      "## 一",
      "",
      "一の書き出し。",
      "",
      "- 項目",
      "",
      "## 二",
      "",
      "二の書き出し。続き。",
      "",
      "## 三",
      "",
      "三の書き出し。",
      "",
      "| 欄 |",
      "",
    ].join("\n");
    const doc = buildDocument("t.md", source, ja);
    assert.deepEqual(
      [...sectionOpeners(doc.sections, doc.source)].map((each) => each.text.trim()),
      ["一の書き出し。", "三の書き出し。"],
    );
  });
});

describe("ngram-repetition: a formula that opens each section", () => {
  it("does not count a phrase that only opens sections, each leading into a list", async () => {
    await ja.prepare?.({ pos: true });
    const body = RESOURCES.map((name, index) => `## ${name}\n\n${FORMULA}\n\n- 長さは ${String(index + 3)} 文字まで`).join("\n\n");
    assert.equal(worst(`# 命名の制約\n\n${filler}\n\n${body}\n`), undefined);
  });

  it("still counts the same phrase when it also stands later in a section", async () => {
    await ja.prepare?.({ pos: true });
    const body = RESOURCES.map((name, index) => `## ${name}\n\n名前は短くする。${FORMULA}\n\n- 長さは ${String(index + 3)} 文字まで`).join("\n\n");
    assert.notEqual(worst(`# 命名の制約\n\n${filler}\n\n${body}\n`), undefined);
  });
});
