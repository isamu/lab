import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { documentTermConflicts, type TermWord, type TermWords } from "../packages/chaff/src/facts/document-terms.ts";
import type { ScopedFact } from "../packages/chaff/src/facts/fact-scope.ts";

// 文書全体で一つの値を持つ項目（試用期間）の、表の値と別の節の文の値。

const TERMS: readonly TermWord[] = [
  { pattern: "試用期間", group: "trial" },
  { pattern: "Probation", group: "trial" },
  { pattern: "probation period", group: "trial" },
];
const WORDS: TermWords = { terms: TERMS, determiners: ["the"] };

type Place = {
  readonly key: string;
  readonly amount: number;
  readonly scope: string;
  readonly table?: boolean;
  readonly record?: boolean;
  readonly summary?: boolean;
  readonly unit?: string;
};

const factOf = (place: Place, index: number): ScopedFact => ({
  label: place.key,
  key: place.key.toLowerCase(),
  value: { start: index * 10, end: index * 10 + 2, kind: "quantity", key: String(place.amount), unit: place.unit ?? "month" },
  scope: place.scope,
  part: place.summary === true ? "summary" : "body",
  record: place.record ?? false,
  ...(place.table === true ? { table: true } : {}),
});

const conflicts = (...places: Place[]): string[] =>
  documentTermConflicts(places.map(factOf), WORDS).map(({ fact, other }) => `${fact.label}@${fact.scope}:${fact.value.key}≠${other.key}`);

describe("documentTermConflicts: a table's value against a sentence in another section", () => {
  it("a table cell and a sentence elsewhere that disagree", () => {
    assert.deepEqual(conflicts({ key: "試用期間", amount: 3, scope: "s3", table: true }, { key: "試用期間", amount: 6, scope: "s5" }), ["試用期間@s5:6≠3"]);
    assert.deepEqual(conflicts({ key: "試用期間", amount: 6, scope: "s1" }, { key: "試用期間", amount: 3, scope: "s3", table: true }), ["試用期間@s1:6≠3"]);
    assert.deepEqual(conflicts({ key: "Probation", amount: 3, scope: "s3", table: true }, { key: "probation period", amount: 6, scope: "s5" }), [
      "probation period@s5:6≠3",
    ]);
  });

  it("agreeing values, or a name not in the lexicon", () => {
    assert.deepEqual(conflicts({ key: "試用期間", amount: 3, scope: "s3", table: true }, { key: "試用期間", amount: 3, scope: "s5" }), []);
    assert.deepEqual(conflicts({ key: "研修期間", amount: 3, scope: "s3", table: true }, { key: "研修期間", amount: 6, scope: "s5" }), []);
    assert.deepEqual(conflicts({ key: "正社員の試用期間", amount: 3, scope: "s3", table: true }, { key: "契約社員の試用期間", amount: 6, scope: "s5" }), []);
  });

  it("two tables, two sentences, or tables that give two values are sections per kind, not a conflict", () => {
    assert.deepEqual(conflicts({ key: "試用期間", amount: 3, scope: "s1", table: true }, { key: "試用期間", amount: 6, scope: "s2", table: true }), []);
    assert.deepEqual(conflicts({ key: "試用期間", amount: 3, scope: "s1" }, { key: "試用期間", amount: 6, scope: "s2" }), []);
    assert.deepEqual(
      conflicts(
        { key: "試用期間", amount: 3, scope: "s1", table: true },
        { key: "試用期間", amount: 3, scope: "s1" },
        { key: "試用期間", amount: 6, scope: "s2", table: true },
        { key: "試用期間", amount: 6, scope: "s2" },
      ),
      [],
    );
  });

  it("three values, another unit, a record field, or the same scope (left to the in-section check)", () => {
    assert.deepEqual(
      conflicts(
        { key: "試用期間", amount: 3, scope: "s1", table: true },
        { key: "試用期間", amount: 6, scope: "s2" },
        { key: "試用期間", amount: 9, scope: "s3" },
      ),
      [],
    );
    assert.deepEqual(conflicts({ key: "試用期間", amount: 3, scope: "s1", table: true }, { key: "試用期間", amount: 1, scope: "s2", unit: "year" }), []);
    assert.deepEqual(conflicts({ key: "試用期間", amount: 3, scope: "s1", table: true }, { key: "試用期間", amount: 6, scope: "s2", record: true }), []);
    assert.deepEqual(conflicts({ key: "試用期間", amount: 3, scope: "s1", table: true }, { key: "試用期間", amount: 6, scope: "s1" }), []);
  });

  it("a table heading written with an article is the same name", () => {
    assert.deepEqual(conflicts({ key: "The probation period", amount: 3, scope: "s1", table: true }, { key: "probation period", amount: 6, scope: "s2" }), [
      "probation period@s2:6≠3",
    ]);
    assert.deepEqual(conflicts({ key: "The probation", amount: 3, scope: "s1", table: true }, { key: "probation", amount: 6, scope: "s2" }), [
      "probation@s2:6≠3",
    ]);
  });

  it("an opening or summary value is left to summary-fact-mismatch", () => {
    assert.deepEqual(conflicts({ key: "試用期間", amount: 6, scope: "s0", summary: true }, { key: "試用期間", amount: 3, scope: "s3", table: true }), []);
    assert.deepEqual(conflicts({ key: "試用期間", amount: 3, scope: "s0", summary: true, table: true }, { key: "試用期間", amount: 6, scope: "s3" }), []);
  });

  it("nothing to compare", () => {
    assert.deepEqual(conflicts(), []);
    assert.deepEqual(documentTermConflicts([factOf({ key: "試用期間", amount: 3, scope: "s1", table: true }, 0)], { terms: [], determiners: [] }), []);
  });
});

const RULES = { "fact-conflict": "normal" } as const;

const found = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === "fact-conflict")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const ja2 = (...lines: string[]): string[] => found(["# 求人票", "", ...lines].join("\n"), ja, "ja");
const en2 = (...lines: string[]): string[] => found(["# Job posting", "", ...lines].join("\n"), en, "en");

const TERMS_JA = ["## 条件", "", "| 項目 | 内容 |", "| --- | --- |", "| 雇用形態 | 正社員 |", "| 試用期間 | 3ヶ月 |", ""];
const TERMS_EN = ["## Terms", "", "| Item | Details |", "| --- | --- |", "| Employment | Full-time |", "| Probation | 3 |", ""];

describe("fact-conflict: a whole-document item across sections", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("the terms table and a later sentence (ja)", () => {
    assert.deepEqual(ja2(...TERMS_JA, "## その他", "", "試用期間は6ヶ月で、その間の待遇は本採用と同じです。"), ["試用期間:6ヶ月≠3ヶ月"]);
    assert.deepEqual(ja2(...TERMS_JA, "## その他", "", "試用期間は3ヶ月で、その間の待遇は本採用と同じです。"), []);
  });

  it("the terms table and a later sentence, under another name of the same item (en)", () => {
    assert.deepEqual(en2(...TERMS_EN, "## Other", "", "The probation period is 6. Pay is the same."), ["The probation period:6≠3"]);
    assert.deepEqual(en2(...TERMS_EN, "## Other", "", "The probation period is 3. Pay is the same."), []);
  });

  it("an opening sentence is reported once, by summary-fact-mismatch", () => {
    const source = [
      "# Job posting",
      "",
      "The probation period is 6.",
      "",
      ...TERMS_EN.map((line) => line.replace("| Probation |", "| Probation period |")),
    ].join("\n");
    const findings = runRules(
      buildDocument("t.md", source, en),
      loadRules("en"),
      { "fact-conflict": "normal", "summary-fact-mismatch": "normal" },
      false,
      "business/report",
    ).findings;
    assert.deepEqual(
      findings.filter((finding) => finding.rule === "fact-conflict" || finding.rule === "summary-fact-mismatch").map((finding) => finding.rule),
      ["summary-fact-mismatch"],
    );
  });

  it("sections per type of employment stay apart", () => {
    const perSection = ja2("## 正社員", "", "試用期間は3ヶ月です。", "", "## 契約社員", "", "試用期間は1ヶ月です。");
    assert.deepEqual(perSection, []);
    const tables = ja2(
      "## 正社員",
      "",
      "| 項目 | 内容 |",
      "| --- | --- |",
      "| 試用期間 | 3ヶ月 |",
      "",
      "## 契約社員",
      "",
      "| 項目 | 内容 |",
      "| --- | --- |",
      "| 試用期間 | 1ヶ月 |",
    );
    assert.deepEqual(tables, []);
    assert.deepEqual(ja2(...TERMS_JA, "## 契約社員", "", "契約社員の試用期間は1ヶ月です。"), []);
  });

  it("an item not in the lexicon is still compared only within a section", () => {
    assert.deepEqual(ja2("## 条件", "", "| 項目 | 内容 |", "| --- | --- |", "| 研修期間 | 3ヶ月 |", "", "## その他", "", "研修期間は6ヶ月です。"), []);
  });
});
