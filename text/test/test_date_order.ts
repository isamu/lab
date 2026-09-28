import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 日程として並べた日付の順番（date-order）。言語を問わず、箇条書きと表の行を並びとして読む。

const found = (source: string, adapter: LanguageAdapter = en, language = "en"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "date-order": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "date-order")
    .map((finding) => `${String(finding.values["date"])}<${String(finding.values["previous"])}`);

const list = (...dates: string[]): string => ["# Plan", "", ...dates.map((date) => `- ${date} step`)].join("\n");

describe("date-order", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("an oldest-first list with one date going back", () => {
    assert.deepEqual(found(list("2026-04-01", "2026-05-01", "2026-04-15", "2026-07-01")), ["2026-04-15<2026-05-01"]);
  });

  it("a newest-first list is a right order; one date going forward in it is not", () => {
    assert.deepEqual(found(list("2026-09-01", "2026-08-01", "2026-07-01")), []);
    assert.deepEqual(found(list("2026-09-01", "2026-08-01", "2026-08-15", "2026-07-01")), ["2026-08-15<2026-08-01"]);
  });

  it("without a clear direction (as many steps each way) nothing is said", () => {
    assert.deepEqual(found(list("2026-04-01", "2026-05-01", "2026-04-15")), []);
    assert.deepEqual(found(list("2026-01-01", "2026-02-01", "2026-03-01", "2026-02-15", "2026-01-15")), []);
  });

  it("equal dates do not break the order", () => {
    assert.deepEqual(found(list("2026-04-01", "2026-04-01", "2026-05-01", "2026-06-01")), []);
  });

  it("a line with two dates (a period) is left out of the sequence", () => {
    assert.deepEqual(found(list("2026-04-01", "2026-03-01 to 2026-05-01", "2026-06-01", "2026-07-01")), []);
  });

  it("dates written to different precision are not compared", () => {
    assert.deepEqual(found(list("2026-04-01", "May 2026", "2026-03-01", "2026-07-01")), []);
  });

  it("dates in running text are not a schedule", () => {
    assert.deepEqual(found("# Notes\n\nWe met on 2026-05-01. The plan dates from 2026-04-01. It ends on 2026-03-01."), []);
  });

  it("two lists separated by a paragraph are not joined", () => {
    const source = ["# Plan", "", "- 2026-04-01 a", "- 2026-05-01 b", "- 2026-06-01 c", "", "Later:", "", "- 2026-01-01 d", "- 2026-02-01 e"].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("numbered lists and table rows are sequences too", () => {
    assert.deepEqual(found(["# Plan", "", "1. 2026-04-01 a", "2. 2026-05-01 b", "3. 2026-04-15 c", "4. 2026-07-01 d"].join("\n")), ["2026-04-15<2026-05-01"]);
    const table = [
      "# Plan",
      "",
      "| Step | Date |",
      "| --- | --- |",
      "| a | 2026-04-01 |",
      "| b | 2026-05-01 |",
      "| c | 2026-04-15 |",
      "| d | 2026-07-01 |",
    ].join("\n");
    assert.deepEqual(found(table), ["2026-04-15<2026-05-01"]);
  });

  it("a nested list: children do not break the parents' order, and each group of children is its own sequence", () => {
    const source = [
      "# History",
      "",
      "- 2026-01-01 topic A",
      "  - 2026-06-01 detail",
      "- 2026-02-01 topic B",
      "  - 2026-05-01 detail",
      "- 2026-03-01 topic C",
      "- 2026-04-01 topic D",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("children of different parents are separate sequences", () => {
    const source = [
      "# Plan",
      "",
      "- Phase 1",
      "  - 2026-06-01 a",
      "  - 2026-07-01 b",
      "  - 2026-08-01 c",
      "- Phase 2",
      "  - 2026-01-01 d",
      "  - 2026-02-01 e",
      "  - 2026-03-01 f",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("a list followed straight by a table is two sequences", () => {
    const source = [
      "# Plan",
      "",
      "- 2026-01-01 a",
      "- 2026-02-01 b",
      "- 2026-03-01 c",
      "| Step | Date |",
      "| --- | --- |",
      "| d | 2025-01-01 |",
      "| e | 2025-02-01 |",
      "| f | 2025-03-01 |",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("a table written without leading pipes is a sequence too; a line with a pipe in prose is not a table", () => {
    const table = ["# Plan", "", "Step | Date", "--- | ---", "a | 2026-04-01", "b | 2026-05-01", "c | 2026-04-15", "d | 2026-07-01"].join("\n");
    assert.deepEqual(found(table), ["2026-04-15<2026-05-01"]);
    const prose = ["# Notes", "", "a | 2026-04-01", "b | 2026-05-01", "c | 2026-04-15", "d | 2026-07-01"].join("\n");
    assert.deepEqual(found(prose), []);
  });

  it("a pipeless table's header holding a date is not part of the order", () => {
    const table = ["# Plan", "", "As of 2026-07-01 | Date", "--- | ---", "a | 2026-04-01", "b | 2026-05-01", "c | 2026-04-15", "d | 2026-07-01"].join("\n");
    assert.deepEqual(found(table), ["2026-04-15<2026-05-01"]);
  });

  it("a pipeless table ends at the first line without a pipe; a list after it is its own sequence", () => {
    const source = [
      "# Plan",
      "",
      "Step | Date",
      "--- | ---",
      "a | 2026-04-01",
      "b | 2026-05-01",
      "c | 2026-06-01",
      "",
      "- 2026-01-01 x",
      "- 2026-02-01 y",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("a dash line with a pipe after a list item without one does not turn the item into a table header", () => {
    assert.deepEqual(found(`${list("2026-04-01", "2026-05-01", "2026-04-15", "2026-07-01")}\n--- | ---`), ["2026-04-15<2026-05-01"]);
  });

  it("a date in a table's header row is not part of the order", () => {
    const table = [
      "# Plan",
      "",
      "| As of 2026-07-01 | Date |",
      "| --- | --- |",
      "| a | 2026-04-01 |",
      "| b | 2026-05-01 |",
      "| c | 2026-04-15 |",
      "| d | 2026-07-01 |",
    ].join("\n");
    assert.deepEqual(found(table), ["2026-04-15<2026-05-01"]);
  });

  it("the sample schedules: the English table's third row, not the newest-first history", () => {
    assert.deepEqual(found(readFileSync(new URL("fixtures/dates/schedule-en.md", import.meta.url), "utf8")), ["2026-04-15<2026-05-01"]);
  });

  it("the Japanese sample itinerary: the third day goes back a month", () => {
    const source = readFileSync(new URL("fixtures/dates/schedule-ja.md", import.meta.url), "utf8");
    assert.deepEqual(found(source, ja, "ja"), ["2026-09-03<2026-10-02"]);
  });
});
