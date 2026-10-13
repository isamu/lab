import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { fencedLineIndexes } from "../packages/chaff/src/structure/fenced-lines.ts";
import { tablesOf } from "../packages/chaff/src/facts/table-facts.ts";
import { linesOf } from "../packages/chaff/src/structure/lines.ts";
import { runsOf } from "../packages/chaff/src/structure/runs.ts";
import { withoutCodeBlocks } from "../packages/chaff/src/detectors/code-fences.ts";

// A table, a list or a sentence written in a fenced code block is an example, not the document's own values: the rules
// that read values from the source line by line skip it, and still read the same lines written outside one.

const fenced = (...lines: string[]): number[] => [...fencedLineIndexes(lines)];

describe("fencedLineIndexes", () => {
  it("marks the lines of a fenced block, the fences included", () => {
    assert.deepEqual(fenced("text", "```markdown", "| a | b |", "```", "after"), [1, 2, 3]);
    assert.deepEqual(fenced("~~~", "x", "~~~", "y"), [0, 1, 2]);
  });

  it("closes only on the same mark at least as long, with nothing after it", () => {
    assert.deepEqual(fenced("````", "```", "x", "````", "y"), [0, 1, 2, 3]);
    assert.deepEqual(fenced("```", "~~~", "x", "```", "y"), [0, 1, 2, 3]);
    assert.deepEqual(fenced("```", "``` js", "x", "``` ", "y"), [0, 1, 2, 3]);
  });

  it("an unclosed fence runs to the end", () => {
    assert.deepEqual(fenced("a", "```", "b", "c"), [1, 2, 3]);
  });

  it("an indented fence (in a list item) is a fence", () => {
    assert.deepEqual(fenced("- step", "   ```", "   | a |", "   ```", "- next"), [1, 2, 3]);
    assert.deepEqual(fenced("1. step", "", "    ```", "    | a |", "    ```", "", "2. next"), [2, 3, 4]);
  });

  it("a line indented as code neither opens nor closes a fence", () => {
    assert.deepEqual(fenced("text", "", "    ```", "", "| a | b |", "| --- | --- |"), []);
    assert.deepEqual(fenced("```", "x", "    ```", "y", "```", "z"), [0, 1, 2, 3, 4]);
  });

  it("does not read a short run, an inline span, or a fence in a quotation", () => {
    assert.deepEqual(fenced("``", "x"), []);
    assert.deepEqual(fenced("```js``` is inline", "x"), []);
    assert.deepEqual(fenced("> ```", "> x", "> ```", "y"), []);
    assert.deepEqual(fenced(), []);
  });
});

const TABLE = ["| 項目 | 数量 |", "| --- | --- |", "| 宿泊 | 2 |"];

describe("tablesOf and runsOf skip what a code block holds", () => {
  it("reads a table outside a fence and not the same table inside one", () => {
    const headersOf = (source: string): string[] => tablesOf(linesOf(source)).map((table) => table.header.text);
    assert.deepEqual(headersOf(TABLE.join("\n")), ["| 項目 | 数量 |"]);
    assert.deepEqual(headersOf(["```", ...TABLE, "```"].join("\n")), []);
    assert.deepEqual(headersOf(["```", ...TABLE, "```", "", ...TABLE].join("\n")), ["| 項目 | 数量 |"]);
  });

  it("makes no run of a list inside a fence", () => {
    const list = ["- 10:00 受付", "- 11:00 開会"];
    assert.equal(runsOf(list.join("\n")).length, 1);
    assert.equal(runsOf(["```", ...list, "```"].join("\n")).length, 0);
  });

  it("withoutCodeBlocks blanks a fenced block and keeps every offset", () => {
    const source = ["a", "```", "b 10:00", "```", "c"].join("\n");
    const blanked = withoutCodeBlocks(source);
    assert.equal(blanked.length, source.length);
    assert.deepEqual(blanked.split("\n"), ["a", "   ", "       ", "   ", "c"]);
    assert.equal(withoutCodeBlocks("no code here"), "no code here");
  });
});

const rulesOf = (source: string, adapter: LanguageAdapter, language: string, rules: readonly string[], genre: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), Object.fromEntries(rules.map((rule) => [rule, "normal"])), false, genre)
    .findings.map((finding) => finding.rule)
    .filter((rule) => rules.includes(rule));

const inFence = (lines: readonly string[]): string[] => ["Write it like this.", "", "```markdown", ...lines, "```"];

describe("rules that read values from the source do not report a code block", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("fact-conflict: two rows with one heading and two values (ja)", () => {
    const rows = ["| 日付 | 項目 | 数量 |", "| --- | --- | --- |", "| 宿泊 | 東京 | 1 |", "| 宿泊 | 東京 | 2 |"];
    const check = (lines: readonly string[]): string[] => rulesOf(["# 例", "", ...lines, ""].join("\n"), ja, "ja", ["fact-conflict"], "business/report");
    assert.deepEqual(check(rows), ["fact-conflict"]);
    assert.deepEqual(check(inFence(rows)), []);
  });

  it("the guide's expense example: a date in the first column, in a fence (ja)", () => {
    const rows = [
      "| 日付 | 項目 | 数量 | 単価 | 金額 |",
      "| --- | --- | --- | --- | --- |",
      "| 10月14日 | 新幹線 | 1 | 28,340円 | 28,340円 |",
      "| 10月14日 | 宿泊 | 2 | 9,500円 | 19,000円 |",
    ];
    assert.deepEqual(rulesOf(["# 例", "", ...inFence(rows), ""].join("\n"), ja, "ja", ["fact-conflict"], "blog/tech"), []);
  });

  it("total-mismatch: a total of bare numbers that is not the sum (en)", () => {
    const rows = ["| Course | Credits |", "| --- | --- |", "| Chemistry | 4 |", "| Statistics | 3 |", "| Total credits | 9 |"];
    const check = (lines: readonly string[]): string[] => rulesOf(["# Claim", "", ...lines, ""].join("\n"), en, "en", ["total-mismatch"], "business/report");
    assert.deepEqual(check(rows), ["total-mismatch"]);
    assert.deepEqual(check(inFence(rows)), []);
  });

  it("time-range-reversed: a range that ends before it starts (ja)", () => {
    const check = (lines: readonly string[]): string[] =>
      rulesOf(["# 予定", "", ...lines, ""].join("\n"), ja, "ja", ["time-range-reversed"], "business/report");
    assert.deepEqual(check(["- 14:00〜13:30 説明会"]), ["time-range-reversed"]);
    assert.deepEqual(check(inFence(["- 14:00〜13:30 説明会"])), []);
  });

  it("product-exceeds-maximum: an amount per use over the daily maximum (en)", () => {
    const line = "Take 2 tablets at a time, up to 3 times a day. The maximum daily dose is 4 tablets.";
    const check = (lines: readonly string[]): string[] =>
      rulesOf(["# Directions", "", ...lines, ""].join("\n"), en, "en", ["product-exceeds-maximum"], "docs/manual");
    assert.deepEqual(check([line]), ["product-exceeds-maximum"]);
    assert.deepEqual(check(inFence([line])), []);
  });
});
