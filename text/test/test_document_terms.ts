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

  it("the number of dependants in a table and in a sentence of another section (ja, en)", () => {
    const tableJa = ["## 扶養親族", "", "| 区分 | 人数 |", "| --- | --- |", "| 一般の扶養親族 | 1人 |", "| 扶養親族の数 | 2人 |", "", "## 控除"];
    assert.deepEqual(ja2(...tableJa, "", "扶養親族の数は3人です。"), ["扶養親族の数:3人≠2人"]);
    assert.deepEqual(ja2(...tableJa, "", "扶養人数は3人です。"), ["扶養人数:3人≠2人"]);
    assert.deepEqual(ja2(...tableJa, "", "扶養親族の数は2人です。"), []);
    assert.deepEqual(ja2(...tableJa, "", "一般の扶養親族は2人です。"), []);
    const tableEn = [
      "## Dependants",
      "",
      "| Dependant | Count |",
      "| --- | --- |",
      "| Other dependants | 1 |",
      "| Number of dependants | 2 |",
      "",
      "## Deductions",
    ];
    assert.deepEqual(en2(...tableEn, "", "The number of dependants is 3, as you declared."), ["The number of dependants:3≠2"]);
    assert.deepEqual(en2(...tableEn, "", "The number of dependants is 2, as you declared."), []);
    assert.deepEqual(en2(...tableEn, "", "Other dependants: 2"), []);
  });

  it("the days in hospital in a table and in a sentence (ja, en)", () => {
    const tableJa = ["## 入院の概要", "", "| 項目 | 内容 |", "| --- | --- |", "| 病棟 | 西3階 |", "| 入院日数 | 5日 |", ""];
    assert.deepEqual(ja2(...tableJa, "今回の入院日数は、6日です。"), ["今回の入院日数:6日≠5日"]);
    assert.deepEqual(ja2(...tableJa, "## 診療明細", "", "入院日数は6日です。"), ["入院日数:6日≠5日"]);
    assert.deepEqual(ja2(...tableJa, "今回の入院日数は、5日です。"), []);
    assert.deepEqual(ja2(...tableJa, "前回の入院日数は、6日です。"), []);
    const tableEn = ["## Stay", "", "| Item | Detail |", "| --- | --- |", "| Ward | West 3 |", "| Days in hospital | 5 days |", ""];
    assert.deepEqual(en2(...tableEn, "This stay was 6 days in hospital."), ["days in hospital:6 days≠5 days"]);
    assert.deepEqual(en2(...tableEn, "## Charges", "", "The length of stay was 6 days."), ["The length of stay:6 days≠5 days"]);
    assert.deepEqual(en2(...tableEn, "This stay was 5 days in hospital."), []);
    assert.deepEqual(en2(...tableEn, "Cover starts after 3 days in hospital."), []);
    assert.deepEqual(en2(...tableEn, "The previous stay was 6 days in hospital."), []);
  });

  it("the carton count in a table's total row, under a column named for it (ja, en)", () => {
    const tableJa = [
      "## 梱包",
      "",
      "| 品名 | 箱数 | 総重量 |",
      "| --- | --- | --- |",
      "| 軸受け | 2箱 | 80kg |",
      "| ボルト | 3箱 | 40kg |",
      "| 合計 | 5箱 | 120kg |",
      "",
    ];
    assert.deepEqual(ja2(...tableJa, "## 荷印", "", "箱数は6箱です。"), ["箱数:6箱≠5箱"]);
    assert.deepEqual(ja2(...tableJa, "## 荷印", "", "箱数は5箱です。"), []);
    assert.deepEqual(ja2(...tableJa, "## 荷印", "", "ボルト 箱数は2箱です。"), []);
    const otherColumn = ["## 梱包", "", "| 品名 | 数量 | 総重量 |", "| --- | --- | --- |", "| 軸受け | 2箱 | 80kg |", "| 合計 | 5箱 | 120kg |", ""];
    assert.deepEqual(ja2(...otherColumn, "## 荷印", "", "箱数は6箱です。"), []);
    const subtotal = ["## 梱包", "", "| 品名 | 箱数 |", "| --- | --- |", "| 軸受け | 2箱 |", "| ボルト | 3箱 |", "| 小計 | 5箱 |", ""];
    assert.deepEqual(ja2(...subtotal, "## 二便目", "", "箱数は6箱です。"), []);
    const rowNotTotal = ["## 梱包", "", "| 品名 | 箱数 | 総重量 |", "| --- | --- | --- |", "| 軸受け | 5箱 | 80kg |", ""];
    assert.deepEqual(ja2(...rowNotTotal, "## 荷印", "", "箱数は6箱です。"), []);
    const tableEn = [
      "## Packages",
      "",
      "| Description | Number of cartons | Gross weight |",
      "| --- | --- | --- |",
      "| Sensors | 2 | 80 kg |",
      "| Brackets | 2 | 40 kg |",
      "| Total | 4 | 120 kg |",
      "",
    ];
    assert.deepEqual(en2(...tableEn, "## Marks", "", "Number of cartons: 5"), ["Number of cartons:5≠4"]);
    assert.deepEqual(en2(...tableEn, "## Marks", "", "Number of cartons: 4"), []);
  });

  it("the floor area in a table and in a sentence of a later section, in an area unit (ja, en)", () => {
    const tableJa = ["## 物件の概要", "", "| 項目 | 内容 |", "| --- | --- |", "| 間取り | 1K |", "| 専有面積 | 30.2㎡ |", "", "## 賃料"];
    assert.deepEqual(ja2(...tableJa, "", "専有面積は30.0㎡です。"), ["専有面積:30.0㎡≠30.2㎡"]);
    assert.deepEqual(ja2(...tableJa, "", "床面積は30.0㎡です。"), ["床面積:30.0㎡≠30.2㎡"]);
    assert.deepEqual(ja2(...tableJa, "", "専有面積は30.2㎡です。"), []);
    assert.deepEqual(ja2(...tableJa, "", "バルコニー面積は5.0㎡です。"), []);
    const roomsJa = ["## 101号室", "", "| 項目 | 内容 |", "| --- | --- |", "| 専有面積 | 25.0㎡ |", "", "## 102号室", "", "| 項目 | 内容 |", "| --- | --- |"];
    assert.deepEqual(ja2(...roomsJa, "| 専有面積 | 30.0㎡ |", "", "## 備考", "", "専有面積は30.0㎡です。"), []);
    const tableEn = ["## Property", "", "| Item | Detail |", "| --- | --- |", "| Layout | One bedroom |", "| Floor area | 30.2 m² |", "", "## Rent"];
    assert.deepEqual(en2(...tableEn, "", "The floor area is 30.0 m²."), ["The floor area:30.0 m²≠30.2 m²"]);
    assert.deepEqual(en2(...tableEn, "", "The floor area is 30.2 m²."), []);
    assert.deepEqual(en2(...tableEn, "", "The service area is 30.0 m²."), []);
  });

  it("an area named only 面積 / Area stays per section: a site area and a unit's area are different items", () => {
    const siteJa = ["## 敷地", "", "| 項目 | 内容 |", "| --- | --- |", "| 面積 | 500.0㎡ |", "", "## 店舗区画"];
    assert.deepEqual(ja2(...siteJa, "", "面積は50.0㎡です。"), []);
    const siteEn = ["## Site", "", "| Item | Detail |", "| --- | --- |", "| Area | 500 sq m |", "", "## Unit 3"];
    assert.deepEqual(en2(...siteEn, "", "The area is 50 sq m."), []);
  });

  it("an item not in the lexicon is still compared only within a section", () => {
    assert.deepEqual(ja2("## 条件", "", "| 項目 | 内容 |", "| --- | --- |", "| 研修期間 | 3ヶ月 |", "", "## その他", "", "研修期間は6ヶ月です。"), []);
  });
});
