import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { boldLabelOf } from "../packages/chaff/src/detectors/bold-label.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// bold-label-list: list items that open with a bold label and a colon ("- **速さ**：…"). Every example is self-written.

const idsFor = (source: string, adapter: LanguageAdapter, genre = "blog/tech"): string[] => firedRules(adapter, source, genre);

const labelledList = (count: number): string => Array.from({ length: count }, (_unused, index) => `- **項目${index + 1}**：説明を書きます。`).join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("boldLabelOf: an item that opens with a bold label", () => {
  const labelled: readonly (readonly [string, string])[] = [
    ["- **速さ**：一覧が速く出ます。", "速さ"],
    ["- **速さ**: 一覧が速く出ます。", "速さ"],
    ["- **速さ:** 一覧が速く出ます。", "速さ"],
    ["- **速さ：**一覧が速く出ます。", "速さ"],
    ["* __Speed__: the list loads fast.", "Speed"],
    ["+ **Speed**:the list loads fast.", "Speed"],
    ["1. **手順**：設定を開きます。", "手順"],
    ["10) **手順**：設定を開きます。", "手順"],
    ["- [ ] **確認**：ログを見ます。", "確認"],
    ["- [x] **確認**：ログを見ました。", "確認"],
    ["  - **入れ子**：内側の項目です。", "入れ子"],
    ["- **速さ**：一覧が速く出ます。\n  続きの行です。", "速さ"],
    ["- **`timeout` の決め方**：短くします。", "`timeout` の決め方"],
  ];
  labelled.forEach(([item, label]) => {
    it(`reads ${JSON.stringify(item)} as labelled "${label}"`, () => assert.equal(boldLabelOf(item), label));
  });

  const unlabelled: readonly (readonly [string, string])[] = [
    ["- 速さ：一覧が速く出ます。", "no bold"],
    ["- **速さ**が大事です。", "no colon after the bold"],
    ["- **速さ**：", "nothing after the colon"],
    ["- **速さ**：   ", "only spaces after the colon"],
    ["- **速さ**\n  ：一覧が速く出ます。", "the colon on the next line"],
    ["- 一覧は **速い**：本当です。", "the bold is not at the start"],
    ["- **`--timeout`**: seconds to wait.", "a label that is only code"],
    ["- **`timeout_ms`**：待つ時間。", "a label that is only code (full-width colon)"],
    ["- **a** and **b**: both.", "two bold runs, the colon after the second"],
    ["- ** 速さ**：一覧が速く出ます。", "a space just inside the opening delimiter"],
    ["- **速さ*：一覧が速く出ます。", "an unclosed label"],
    [`- **${"長".repeat(41)}**：説明です。`, "a bold run longer than a label"],
    ["", "empty"],
    ["-", "a bare marker"],
  ];
  unlabelled.forEach(([item, why]) => {
    it(`does not read ${JSON.stringify(item)} (${why})`, () => assert.equal(boldLabelOf(item), undefined));
  });

  it("reads an item whose marker was already stripped", () => assert.equal(boldLabelOf("**速さ**：一覧が速く出ます。"), "速さ"));

  it("reads only the first line of an item, over generated items", () => {
    const PIECES = ["- ", "1. ", "2) ", "  ", "[x] ", "**", "__", "*", ":", "：", " ", "\n", "a", "速さ", "`"];
    const SAMPLES_TO_TRY = 20000;
    const generated = (seed: number): string =>
      Array.from({ length: 1 + (seed % 12) }, (_unused, index) => PIECES[(seed * 31 + index * 17 + ((seed >> 3) ^ index)) % PIECES.length] ?? "").join("");
    Array.from({ length: SAMPLES_TO_TRY }, (_unused, seed) => generated(seed)).forEach((item) => {
      assert.equal(boldLabelOf(item), boldLabelOf(item.split("\n")[0] ?? ""), JSON.stringify(item));
    });
  });

  it("takes a label of exactly the longest length", () => assert.equal(boldLabelOf(`- **${"長".repeat(40)}**：説明です。`), "長".repeat(40)));
});

describe("bold-label-list", () => {
  it("invalid: five items open with a bold label", () => {
    assert.ok(idsFor(`# 新しい在庫システム\n\n${labelledList(5)}\n`, ja).includes("bold-label-list"));
  });

  it("invalid: the labels are counted across separate lists", () => {
    const source = `# 記事\n\n${labelledList(3)}\n\n本文です。\n\n${labelledList(2)}\n`;
    assert.ok(idsFor(source, ja).includes("bold-label-list"));
  });

  it("valid: four labelled items stay under the normal level", () => {
    assert.ok(!idsFor(`# 記事\n\n${labelledList(4)}\n`, ja).includes("bold-label-list"));
  });

  it("valid: items without bold labels are not counted", () => {
    const plain = Array.from({ length: 8 }, (_unused, index) => `- 項目${index + 1}：説明を書きます。`).join("\n");
    assert.ok(!idsFor(`# 記事\n\n${plain}\n`, ja).includes("bold-label-list"));
  });

  it("valid: a list of options labelled in code is reference documentation", () => {
    const options = Array.from({ length: 8 }, (_unused, index) => `- **\`--option-${index}\`**：説明を書きます。`).join("\n");
    assert.ok(!idsFor(`# 記事\n\n${options}\n`, ja).includes("bold-label-list"));
  });

  it("valid: a bold label in a code block is not a list item", () => {
    assert.ok(!idsFor(`# 記事\n\n\`\`\`md\n${labelledList(8)}\n\`\`\`\n`, ja).includes("bold-label-list"));
  });

  it("valid: a technical document is not checked", () => {
    assert.ok(!idsFor(`# 仕様\n\n${labelledList(8)}\n`, ja, "technical/spec").includes("bold-label-list"));
  });

  it("valid: an English document is not checked", () => {
    const list = Array.from({ length: 8 }, (_unused, index) => `- **Item ${index + 1}**: what it does.`).join("\n");
    assert.ok(!idsFor(`# Post\n\n${list}\n`, en).includes("bold-label-list"));
  });
});
