import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { foldedLabel, labelGroups, labelKeys, oddSpellings, tableHeaderCells, type HeaderCell } from "../packages/chaff/src/detectors/table-header.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// table-header-variant: one column header written two ways across a document's tables. Every example is self-written.

const RULE = "table-header-variant";

const findingsOf = (adapter: LanguageAdapter, source: string, path = "t.md"): Finding[] =>
  runRules(buildDocument(path, source, adapter), loadRules(adapter.id), {}, true, "business/report").findings.filter((finding) => finding.rule === RULE);

const flagged = (adapter: LanguageAdapter, source: string): string[] => findingsOf(adapter, source).map((finding) => String(finding.values["written"]));

const table = (header: readonly string[], ...rows: (readonly string[])[]): string =>
  [header, header.map(() => "---"), ...rows].map((cells) => `| ${cells.join(" | ")} |`).join("\n");

const doc = (...tables: string[]): string => ["# 表", "", ...tables.flatMap((entry) => [entry, ""])].join("\n");

const affixesOf = (adapter: LanguageAdapter): string[] => (adapter.lexicons["label-affix"] ?? []).map((entry) => foldedLabel(entry.pattern));

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("tableHeaderCells: the label cells of a document's tables", () => {
  it("reads the header row, with its offsets", () => {
    const source = "| 作業 | 担当者 |\n| --- | :-: |\n| 発注 | 山田 |\n";
    assert.deepEqual(tableHeaderCells(source), [
      { written: "作業", offset: 2 },
      { written: "担当者", offset: 7 },
      { written: "発注", offset: 2 + source.indexOf("発注") - 2 },
    ]);
  });

  it("reads the first cell of each row of a two-column table, not of a wider one", () => {
    assert.deepEqual(
      tableHeaderCells(table(["項目", "内容"], ["担当者", "山田"], ["期限", "月末"])).map((cell) => cell.written),
      ["項目", "内容", "担当者", "期限"],
    );
    assert.deepEqual(
      tableHeaderCells(table(["項目", "内容", "備考"], ["担当者", "山田", "-"])).map((cell) => cell.written),
      ["項目", "内容", "備考"],
    );
  });

  it("drops markup and cells without letters", () =>
    assert.deepEqual(
      tableHeaderCells("| **Owner** | `id` | 2024 |\n|---|---|---|\n").map((cell) => cell.written),
      ["Owner", "id"],
    ));

  it("keeps an underscore inside a word and points past the markup", () => {
    assert.deepEqual(tableHeaderCells("| **Owner** | user_id |\n|---|---|\n"), [
      { written: "Owner", offset: 4 },
      { written: "user_id", offset: 14 },
    ]);
  });

  it("does not read a delimiter row with a different number of cells", () => assert.deepEqual(tableHeaderCells("| a | b |\n| --- |\n"), []));

  it("does not read a table in indented code, nor inside a ~~~ line within a ``` fence", () => {
    assert.deepEqual(tableHeaderCells("    | a | b |\n    | --- | --- |\n"), []);
    assert.deepEqual(tableHeaderCells("```\n~~~\n| a | b |\n| --- | --- |\n```\n"), []);
  });

  it("does not read a table inside fenced code, nor a row without a delimiter under it", () => {
    assert.deepEqual(tableHeaderCells("```\n| a | b |\n| --- | --- |\n```\n"), []);
    assert.deepEqual(tableHeaderCells("| a | b |\n| c | d |\n"), []);
  });
});

describe("labelKeys and labelGroups: which headers are one label", () => {
  it("folds width, case, spaces, hyphens and middle dots", () => {
    assert.equal(foldedLabel("E-mail"), foldedLabel("Email"));
    assert.equal(foldedLabel("Due Date"), foldedLabel("due date"));
    assert.equal(foldedLabel("ＩＤ"), foldedLabel("ID"));
    assert.equal(foldedLabel("会社・団体"), foldedLabel("会社団体"));
  });

  it("drops an affix the lexicon lists, keeping a stem of two characters or more", () => {
    assert.ok(labelKeys("担当者", affixesOf(ja)).has("担当"));
    assert.ok(labelKeys("Owners", affixesOf(en)).has("owner"));
    assert.ok(labelKeys("Addresses", affixesOf(en)).has("address"));
    assert.ok(!labelKeys("名", affixesOf(ja)).has(""));
    assert.deepEqual([...labelKeys("As", affixesOf(en))], ["as"]);
  });

  it("groups Address with Addresses, and keeps Date apart from Time", () => {
    const cell = (written: string, offset: number): HeaderCell => ({ written, offset });
    const groups = labelGroups([cell("Address", 0), cell("Date", 1), cell("Addresses", 2), cell("Time", 3)], affixesOf(en));
    assert.deepEqual(
      groups.map((group) => group.map((entry) => entry.written)),
      [["Address", "Addresses"], ["Date"], ["Time"]],
    );
  });
});

describe("oddSpellings: the less common spelling of one label", () => {
  const cell = (written: string, offset: number): HeaderCell => ({ written, offset });
  it("is the later one on a tie", () => assert.deepEqual(oddSpellings([cell("担当者", 0), cell("担当", 1)], 50).odd, [cell("担当", 1)]));
  it("is the rarer one", () => assert.deepEqual(oddSpellings([cell("担当", 0), cell("担当者", 1), cell("担当者", 2)], 50).odd, [cell("担当", 0)]));
  it("is none past the limit", () => assert.deepEqual(oddSpellings([cell("担当者", 0), cell("担当", 1)], 34).odd, []));
  it("is none for one spelling", () => assert.deepEqual(oddSpellings([cell("担当", 0), cell("担当", 1)], 50).odd, []));
});

describe("table-header-variant: a header written two ways", () => {
  it("reports 担当 against 担当者", () =>
    assert.deepEqual(flagged(ja, doc(table(["作業", "担当者"], ["発注", "山田"]), table(["作業", "担当"], ["検品", "鈴木"]))), ["担当"]));

  it("reports Owners against Owner", () =>
    assert.deepEqual(flagged(en, doc(table(["Task", "Owner"], ["Order", "Kim"]), table(["Task", "Owners"], ["Check", "Lee"]))), ["Owners"]));

  it("reports a field name against a header", () =>
    assert.deepEqual(flagged(ja, doc(table(["作業", "担当者"], ["発注", "山田"]), table(["項目", "内容"], ["担当", "鈴木"]))), ["担当"]));

  it("names the usual spelling and the line", () => {
    const finding = findingsOf(en, doc(table(["Task", "Owner"], ["Order", "Kim"]), table(["Task", "Owners"], ["Check", "Lee"])))[0];
    assert.equal(finding?.values["usual"], "Owner");
    assert.equal(finding?.line, 7);
  });

  it("does not report one spelling used throughout", () =>
    assert.deepEqual(flagged(ja, doc(table(["作業", "担当者"], ["発注", "山田"]), table(["作業", "担当者"], ["検品", "鈴木"]))), []));

  it("does not report different labels", () =>
    assert.deepEqual(flagged(en, doc(table(["Date", "Owner"], ["May", "Kim"]), table(["Time", "Lead"], ["9", "Lee"]))), []));

  it("says it did not run on plain text", () => {
    const result = runRules(buildDocument("t.txt", "plain text\n", en), loadRules("en"), {}, true, "business/report");
    assert.ok(result.skipped.some((entry) => entry.rule === RULE));
  });
});
