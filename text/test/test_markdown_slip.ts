import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { strayStrongRuns } from "../packages/chaff/src/detectors/markdown-slip.ts";

// Markdown that does not render the way it was written. Self-written examples.

const run =
  (rule: string) =>
  (source: string, adapter = ja, path = "a.md"): readonly string[] =>
    namedRuleRun(rule, `${source}\n`, adapter, path).findings;

const overflow = run("table-row-overflow");
const fence = run("unclosed-code-fence");
const emphasis = run("unrendered-emphasis");

describe("table-row-overflow", () => {
  it("reports a row with more cells than the header", () => {
    assert.deepEqual(overflow("| 項目 | 金額 |\n| --- | --- |\n| 会場 | 5万円 |\n| 飲食 | 3万円 | 予備費込み |"), [
      "この行はセルが 3 個あり、見出しの行の 2 列を超えた分は表示されません",
    ]);
    assert.deepEqual(overflow("| Item | Cost |\n| --- | --- |\n| Food | $300 | reserve |", en), [
      "This row has 3 cells; past the header's 2 columns they are not shown",
    ]);
  });

  it("does not report a short row, an escaped bar, a quoted table, or a plain-text file", () => {
    assert.deepEqual(overflow("| A | B |\n| --- | --- |\n| a |", en), []);
    assert.deepEqual(overflow("| A | B |\n| --- | --- |\n| a | b | |", en), []);
    assert.deepEqual(overflow("| A | B |\n| --- | --- |\n| a | b | <!-- lint-disable-line --> |", en), []);
    assert.deepEqual(overflow("| A | B |\n| --- | --- |\n| a \\| b | c |", en), []);
    assert.deepEqual(overflow("> | A | B |\n> | --- | --- |\n> | a | b | c |", en), []);
    assert.deepEqual(overflow("| A | B |\n| --- | --- |\n| a | b | c |", en, "a.txt"), []);
  });
});

describe("unclosed-code-fence", () => {
  it("reports a fence left open to the end of the document", () => {
    assert.deepEqual(fence("手順です。\n\n```sh\nnpm install\n\n## 確認\n\n動かします。"), ["「```sh」で始めたコードブロックが閉じていません"]);
    assert.deepEqual(fence("Run it.\n\n~~~\nmake", en), ['The code block opened with "~~~" is never closed']);
  });

  it("reports a fence whose closing line is shorter or has words after it", () => {
    assert.deepEqual(fence("````\ncode\n```\n\nText.", en), ['The code block opened with "````" is never closed']);
    assert.deepEqual(fence("```\ncode\n``` end\n\nText.", en), ['The code block opened with "```" is never closed']);
    assert.deepEqual(fence("```\ncode\n    ```", en), ['The code block opened with "```" is never closed']);
    assert.deepEqual(fence("```\r\ncode\r\n", en), ['The code block opened with "```" is never closed']);
  });

  it("does not report a closed fence, a longer closing fence, an indented block, a quotation, or a plain-text file", () => {
    assert.deepEqual(fence("```sh\nnpm install\n```\n\nText.", en), []);
    assert.deepEqual(fence("```sh\r\nnpm install\r\n```\r\n\r\nText.", en), []);
    assert.deepEqual(fence("```\ncode\n`````\n\nText.", en), []);
    assert.deepEqual(fence("- item\n\n  ```\n  code\n  ```\n\nText.", en), []);
    assert.deepEqual(fence("Text.\n\n    code\n", en), []);
    assert.deepEqual(fence("> ```\n> code", en), []);
    assert.deepEqual(fence("```\ncode", en, "a.txt"), []);
  });
});

describe("strayStrongRuns", () => {
  it("finds an open mark, and leaves word-inner, lone, long and dunder runs", () => {
    assert.deepEqual(strayStrongRuns("the **deadline"), [{ start: 4, end: 6 }]);
    assert.deepEqual(strayStrongRuns("2**10 and snake__case"), []);
    assert.deepEqual(strayStrongRuns("a ** b"), []);
    assert.deepEqual(strayStrongRuns("Name: ________ and ***"), []);
    assert.deepEqual(strayStrongRuns("call __init__ first"), []);
  });
});

describe("unrendered-emphasis", () => {
  it("reports a strong mark left open", () => {
    assert.deepEqual(emphasis("締め切りは**金曜日です。"), ["「**」が太字にならず、そのまま表示されます"]);
    assert.deepEqual(emphasis("The deadline is **Friday. Do not be late.", en), ['"**" is not turned into bold and shows as written']);
  });

  it("reports marks CommonMark cannot pair: punctuation inside, a letter outside", () => {
    assert.deepEqual(emphasis("これは**「重要」**です。"), ["「**」が太字にならず、そのまま表示されます", "「**」が太字にならず、そのまま表示されます"]);
  });

  it("does not report bold that renders, code, quotations, escapes, or a plain-text file", () => {
    assert.deepEqual(emphasis("これは**重要**です。"), []);
    assert.deepEqual(emphasis("Use `a**b` here.", en), []);
    assert.deepEqual(emphasis("> They wrote **open.", en), []);
    assert.deepEqual(emphasis("Write \\*\\* for two stars.", en), []);
    assert.deepEqual(emphasis("Write \\**bold for two stars.", en), []);
    assert.deepEqual(emphasis("The deadline is **Friday.", en, "a.txt"), []);
  });
});
