import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 同じ項目に違う値（fact-conflict）と、冒頭や要約の値が本文と違う（summary-fact-mismatch）。

const RULES = { "fact-conflict": "normal", "summary-fact-mismatch": "normal" } as const;

const found = (rule: string, source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const conflictJa = (...lines: string[]): string[] => found("fact-conflict", ["# 案内", "", ...lines].join("\n"), ja, "ja");
const conflictEn = (...lines: string[]): string[] => found("fact-conflict", ["# Notice", "", ...lines].join("\n"), en, "en");
const summaryJa = (...lines: string[]): string[] => found("summary-fact-mismatch", lines.join("\n"), ja, "ja");
const summaryEn = (...lines: string[]): string[] => found("summary-fact-mismatch", lines.join("\n"), en, "en");

describe("fact-conflict", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("the same label with two values in one section (ja)", () => {
    assert.deepEqual(conflictJa("## 申し込み", "", "締切：10月5日", "", "- 参加費：3,000円", "- 締切：10月7日"), ["締切:10月7日≠10月5日"]);
    assert.deepEqual(conflictJa("## 申し込み", "", "締切：10月5日", "", "- 参加費：3,000円", "- 締切：10月5日"), []);
  });

  it("a label written with は and です, in full width or half width (ja)", () => {
    assert.deepEqual(conflictJa("参加費は3,000円です。会場は本館です。参加費は3,500円です。"), ["参加費:3,500円≠3,000円"]);
    assert.deepEqual(conflictJa("参加費は3,000円です。", "", "参加費は3000円です。"), []);
    assert.deepEqual(conflictJa("参加費：3,000円", "", "参加費：３５００円"), ["参加費:３５００円≠3,000円"]);
  });

  it("the same label with two values in one section (en)", () => {
    assert.deepEqual(conflictEn("Deadline: May 3, 2026", "", "- Fee: $300", "- Deadline: May 5, 2026"), ["Deadline:May 5, 2026≠May 3, 2026"]);
    assert.deepEqual(conflictEn("The fee is $300.", "", "Our fee is $350."), ["Our fee:$350≠$300"]);
    assert.deepEqual(conflictEn("The fee is $300.", "", "Our fee is $300."), []);
  });

  it("a table cell against the prose: the row heading is the label", () => {
    const table = (prose: string): string[] => conflictJa("| 区分 | 料金 |", "| --- | --- |", "| 大人 | 3,000円 |", "| 子供 | 1,000円 |", "", prose);
    assert.deepEqual(table("大人：3,500円"), ["大人:3,500円≠3,000円"]);
    assert.deepEqual(table("大人：3,000円"), []);
    const wide = conflictEn("| Group | Fee | Seats |", "| --- | --- | --- |", "| Adults | $30 | 40 |", "| Adults | $35 | 40 |");
    assert.deepEqual(wide, ["Adults Fee:$35≠$30"]);
  });

  it("an entity's attribute: headquartered in, に本社を置く", () => {
    assert.deepEqual(conflictEn("Acme is headquartered in Austin.", "", "The firm, headquartered in Dallas, grew."), ["headquartered in:Dallas≠Austin"]);
    assert.deepEqual(conflictEn("Acme is headquartered in Austin.", "", "Acme, headquartered in Austin, grew."), []);
    assert.deepEqual(conflictJa("当社は東京に本社を置く会社です。", "", "大阪に本社を置く当社は、創業から十年です。"), ["に本社を置:大阪≠東京"]);
  });

  it("values under different headings, parent items or bold lines are values of different things", () => {
    assert.deepEqual(conflictJa("## 第1回", "", "締切：10月5日", "", "## 第2回", "", "締切：10月12日"), []);
    assert.deepEqual(conflictJa("- 第1回", "  - 締切：10月5日", "- 第2回", "  - 締切：10月12日"), []);
    assert.deepEqual(conflictEn("**Session 1**", "", "- Deadline: May 3, 2026", "", "**Session 2**", "", "- Deadline: May 10, 2026"), []);
    assert.deepEqual(conflictEn("Session 1:", "", "- Deadline: May 3, 2026", "", "Session 2:", "", "- Deadline: May 10, 2026"), []);
  });

  it("a line continuing a list item belongs to that item", () => {
    const lines = [
      "- Trinidad is in maintenance mode.",
      "  Last release was 2017-09-01.",
      "- Tomahawk is in maintenance mode.",
      "  Last release was 2016-05-01.",
    ];
    assert.deepEqual(conflictEn(...lines), []);
    assert.deepEqual(conflictEn("Last release was 2017-09-01.", "", "Last release was 2016-05-01."), ["Last release:2016-05-01≠2017-09-01"]);
  });

  it("a label that heads many lines of one section is a field of repeated records", () => {
    assert.deepEqual(conflictEn("Seats: 30", "", "Seats: 40", "", "Seats: many"), []);
    assert.deepEqual(conflictEn("Seats: 30", "", "Seats: 40"), ["Seats:40≠30"]);
  });

  it("a value with a condition after it, or a label after a comma, is not read", () => {
    assert.deepEqual(conflictJa("参加費は3,000円からです。", "", "参加費は3,500円です。"), []);
    assert.deepEqual(conflictJa("大人は、参加費は3,000円です。", "", "子供は、参加費は1,000円です。"), []);
    assert.deepEqual(conflictEn("The fee is $300 per person.", "", "The fee is $350."), []);
    assert.deepEqual(conflictEn("For adults, the fee is $30.", "", "For children, the fee is $10."), []);
  });

  it("three or more values for one label are a list, not a slip", () => {
    assert.deepEqual(conflictEn("- Seats: 30", "- Seats: 40", "- Seats: 50"), []);
  });

  it("values in another unit, or dates of another precision, are not compared", () => {
    assert.deepEqual(conflictEn("Distance: 5 km", "", "Distance: 3000 m"), []);
    assert.deepEqual(conflictJa("締切：2026年10月5日", "", "締切：10月5日"), []);
    assert.deepEqual(conflictJa("締切：2026年10月5日", "", "締切：10月7日"), ["締切:10月7日≠2026年10月5日"]);
  });

  it("a value in another unit does not hide two values in one unit", () => {
    assert.deepEqual(conflictEn("The fee is €30.", "", "Fee: 3000", "", "Fee: 4000"), ["Fee:4000≠3000"]);
  });

  it("a longer label heading many lines does not make a shorter one a record field", () => {
    assert.deepEqual(conflictEn("Reserved seats: 1", "Reserved seats: 1", "Reserved seats: 1", "Seats: 10", "Seats: 20"), ["Seats:20≠10"]);
  });

  it("only the values that differ from the first are reported, and three values are a list", () => {
    assert.deepEqual(conflictEn("The fee is $300.", "", "The fee is $300.", "", "The fee is $350."), ["The fee:$350≠$300"]);
    assert.deepEqual(conflictEn("The fee is $300.", "", "The fee is $350.", "", "The fee is $400."), []);
  });

  it("a value in another unit is not a conflicting value", () => {
    assert.deepEqual(conflictEn("The fee is €30.", "", "The fee is $30."), []);
  });

  it("a label after a comma is not read even when the text before it repeats", () => {
    assert.deepEqual(conflictEn("Note, the fee is $30.", "", "Note, the fee is $35."), []);
  });

  it("a pronoun is not a label", () => {
    assert.deepEqual(conflictEn("It is $300.", "", "It is $350."), []);
    assert.deepEqual(conflictJa("それは3,000円です。", "", "それは3,500円です。"), []);
  });
});

describe("summary-fact-mismatch", () => {
  it("the opening against the body (ja)", () => {
    const doc = (opening: string): string[] => summaryJa("# 説明会", "", opening, "", "## 申し込み", "", "参加費は3,500円です。");
    assert.deepEqual(doc("参加費は3,000円です。"), ["参加費:3,000円≠3,500円"]);
    assert.deepEqual(doc("参加費は3,500円です。"), []);
  });

  it("a summary section against the body (en)", () => {
    const doc = (summary: string): string[] => summaryEn("# Report", "", "## Summary", "", summary, "", "## Details", "", "- Seats: 40");
    assert.deepEqual(doc("- Seats: 30"), ["Seats:30≠40"]);
    assert.deepEqual(doc("- Seats: 40"), []);
  });

  it("a body that gives the label two values settles nothing", () => {
    const lines = ["# Report", "", "Seats: 30", "", "## First", "", "Seats: 40", "", "## Second", "", "Seats: 50"];
    assert.deepEqual(summaryEn(...lines), []);
  });

  it("a document with no headings has no body to compare with", () => {
    assert.deepEqual(summaryJa("参加費は3,000円です。", "", "参加費は3,500円です。"), []);
  });
});
