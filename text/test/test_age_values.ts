import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { ageValues, type AgeWords } from "../packages/chaff/src/facts/age-values.ts";
import { comparable, sameValue, type FactValue } from "../packages/chaff/src/facts/fact-values.ts";

// 年齢（満70歳、aged 40）、年齢の上限（満70歳まで、up to the age of 70）、年齢の範囲（満20歳〜満70歳）を値として読む。

const WORDS: AgeWords = {
  marks: [
    { pattern: "満", position: "before" },
    { pattern: "歳", position: "after" },
    { pattern: "age", position: "before" },
    { pattern: "aged", position: "before" },
    { pattern: "the age of", position: "before" },
    { pattern: "years old", position: "after" },
  ],
  limits: [
    { pattern: "まで", position: "after" },
    { pattern: "up to", position: "before" },
    { pattern: "or under", position: "after" },
  ],
  joiners: ["〜", "から", "to"],
};

/** 木の読みを真似た値: 「歳」までの数量（70歳）と、単位の無い数（70）と、単位を後ろに持つ数（30 の years）。 */
const valuesIn = (source: string): FactValue[] =>
  [...source.matchAll(/(\d+)(歳)?(?=( years)?)/gu)].map((match): FactValue => {
    const unit = match[2] ?? (match[3] === undefined ? "" : "years");
    return { start: match.index, end: match.index + match[0].length, kind: "quantity", key: match[1] ?? "", unit };
  });

const read = (source: string, values: readonly FactValue[] = valuesIn(source)): string[] =>
  ageValues(source, values, WORDS).map((age) => [source.slice(age.start, age.end), age.key, age.lower ?? "", age.bound ?? "", age.unit].join("/"));

describe("ageValues: a number with an age mark, up to the end of its marks", () => {
  it("one age (ja, en)", () => {
    assert.deepEqual(read("年齢は満70歳です"), ["満70歳/70///"]);
    assert.deepEqual(read("年齢は20歳です"), ["20歳/20///"]);
    assert.deepEqual(read("He was aged 40."), ["aged 40/40///"]);
    assert.deepEqual(read("She is 30 years old."), ["30 years old/30///"]);
    assert.deepEqual(read("At age 65."), ["age 65/65///"]);
  });

  it("an upper limit (ja, en)", () => {
    assert.deepEqual(read("加入できる年齢は、満75歳までです"), ["満75歳まで/75//upper/"]);
    assert.deepEqual(read("You can apply up to the age of 75."), ["up to the age of 75/75//upper/"]);
    assert.deepEqual(read("Children aged 17 or under."), ["aged 17 or under/17//upper/"]);
  });

  it("a range is its upper end, with the lower end kept (ja, en)", () => {
    assert.deepEqual(read("満20歳〜満70歳"), ["満20歳〜満70歳/70/20/upper/"]);
    assert.deepEqual(read("満20歳から満70歳まで"), ["満20歳から満70歳まで/70/20/upper/"]);
    assert.deepEqual(read("20〜70歳"), ["20〜70歳/70/20/upper/"]);
    assert.deepEqual(read("aged 20 to 70"), ["aged 20 to 70/70/20/upper/"]);
    assert.deepEqual(read("Applicants aged 18 to 65 can join."), ["aged 18 to 65/65/18/upper/"]);
  });

  it("a number without an age mark, or with another unit, is not an age", () => {
    assert.deepEqual(read("Seats: 70"), []);
    assert.deepEqual(read("20 to 70"), []);
    assert.deepEqual(read("page 5"), []);
    assert.deepEqual(read("the age of", []), []);
    assert.deepEqual(read("aged 40", [{ start: 5, end: 7, kind: "quantity", key: "40", unit: "kg" }]), []);
    assert.deepEqual(read("aged 40", [{ start: 5, end: 7, kind: "date", key: "40", unit: "" }]), []);
    assert.deepEqual(read(""), []);
  });

  it("a range whose lower end is above its upper end, or that is joined by something else, is two ages", () => {
    assert.deepEqual(read("満70歳〜満20歳"), ["満70歳/70///", "満20歳/20///"]);
    assert.deepEqual(read("満20歳、満70歳"), ["満20歳/20///", "満70歳/70///"]);
    assert.deepEqual(read("aged 20 and 70"), ["aged 20/20///"]);
  });

  it("a mark inside a longer word is not a mark", () => {
    assert.deepEqual(read("Package 40."), []);
    assert.deepEqual(read("Stage 3 to 4"), []);
  });
});

const value = (key: string, extra: Partial<FactValue> = {}): FactValue => ({ start: 0, end: 1, kind: "quantity", key, unit: "", ...extra });

describe("comparable and sameValue: a range, a limit, and one age", () => {
  it("a range and a limit compare by their upper ends", () => {
    const range = value("70", { lower: "20", bound: "upper" });
    assert.ok(comparable(range, value("75", { bound: "upper" })));
    assert.ok(!sameValue(range, value("75", { bound: "upper" })));
    assert.ok(sameValue(range, value("70", { bound: "upper" })));
  });

  it("two ranges compare by both ends", () => {
    const range = value("70", { lower: "20", bound: "upper" });
    assert.ok(sameValue(range, value("70", { lower: "20", bound: "upper" })));
    assert.ok(!sameValue(range, value("70", { lower: "18", bound: "upper" })));
  });

  it("one age is not compared with a range (it may be any age inside it), but is with a limit", () => {
    const range = value("70", { lower: "20", bound: "upper" });
    assert.ok(!comparable(range, value("50")));
    assert.ok(!comparable(value("50"), range));
    assert.ok(comparable(value("70"), value("75", { bound: "upper" })));
  });
});

const RULES = { "fact-conflict": "normal" } as const;

const found = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === "fact-conflict")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const conflictJa = (...lines: string[]): string[] => found(["# 契約概要", "", "前書き。", "", ...lines].join("\n"), ja, "ja");
const conflictEn = (...lines: string[]): string[] => found(["# Policy summary", "", "Introduction.", "", ...lines].join("\n"), en, "en");

const TABLE_JA = ["| 項目 | 内容 |", "| --- | --- |"];
const TABLE_EN = ["| Item | Details |", "| --- | --- |"];

describe("fact-conflict: an age limit written two ways", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a table's limit and a sentence's limit under the same name (ja)", () => {
    assert.deepEqual(conflictJa("## 加入できる方", "", ...TABLE_JA, "| 加入できる年齢 | 満70歳まで |", "", "加入できる年齢は、満75歳までです。"), [
      "加入できる年齢:満75歳まで≠満70歳まで",
    ]);
  });

  it("a table's range and a sentence's limit under two names of one item (ja, en)", () => {
    assert.deepEqual(conflictJa("## 契約年齢", "", ...TABLE_JA, "| 契約年齢 | 満20歳〜満70歳 |", "", "ご契約いただける年齢は、満75歳までです。"), [
      "ご契約いただける年齢:満75歳まで≠満20歳〜満70歳",
    ]);
    assert.deepEqual(
      conflictEn("## Who can apply", "", ...TABLE_EN, "| Age at entry | aged 20 to 70 |", "", "## Other", "", "The maximum age is up to the age of 75."),
      ["The maximum age:up to the age of 75≠aged 20 to 70"],
    );
    assert.deepEqual(conflictEn("## Who can apply", "", ...TABLE_EN, "| Maximum age | 70 |", "", "The maximum age is 75."), ["The maximum age:75≠70"]);
  });

  it("the same upper end, written as a range and as a limit, agrees", () => {
    assert.deepEqual(conflictJa("## 契約年齢", "", ...TABLE_JA, "| 契約年齢 | 満20歳〜満70歳 |", "", "ご契約いただける年齢は、満70歳までです。"), []);
    assert.deepEqual(conflictEn("## Who can apply", "", ...TABLE_EN, "| Age at entry | aged 20 to 70 |", "", "The maximum age is up to the age of 70."), []);
  });

  it("one person's age is not compared with the range", () => {
    assert.deepEqual(conflictJa("## 契約年齢", "", ...TABLE_JA, "| 契約年齢 | 満20歳〜満70歳 |", "", "## 保険料の例", "", "契約年齢は30歳です。"), []);
  });

  it("the ages of different people in a narrative are not compared (ja, en)", () => {
    assert.deepEqual(conflictJa("太郎は20歳です。花子は25歳です。父は45歳、母は43歳です。"), []);
    assert.deepEqual(conflictEn("Taro is 30 years old. Hanako is 25 years old. He was aged 40. She was aged 38."), []);
    assert.deepEqual(conflictEn("The father, aged 45, met the mother, aged 43."), []);
  });

  it("an unlabelled limit is not read as the item (no name in the sentence)", () => {
    assert.deepEqual(conflictEn("## Who can apply", "", ...TABLE_EN, "| Maximum age | 70 |", "", "You can apply up to the age of 75."), []);
  });
});
