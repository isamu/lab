import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import {
  hasCondition,
  namesSubject,
  periodOf,
  rowSentenceConflicts,
  type Amount,
  type AmountRow,
  type SubjectSentence,
} from "../packages/chaff/src/facts/row-sentence-amounts.ts";

// 表の行の金額と、その行の見出しを主語にした文の金額（fact-conflict）。

const JA_WORDS = { separators: ["：", ":", "は", "は、"], determiners: [], conditions: ["場合", "とき"] };
const EN_WORDS = { separators: [":", "is", "are", "was"], determiners: ["the", "our"], conditions: ["if", "other than"] };

describe("namesSubject", () => {
  it("the label right before a separator is the subject", () => {
    assert.equal(namesSubject("入院給付金は、入院1日につき5,000円をお支払いします。", "入院給付金", JA_WORDS), true);
    assert.equal(namesSubject("治療・救援費用は3,000万円まで", "治療・救援費用", JA_WORDS), true);
    assert.equal(namesSubject("Hospital cash is paid at $100 for each day.", "hospital cash", EN_WORDS), true);
    assert.equal(namesSubject("The hospital cash is $100 a day.", "hospital cash", EN_WORDS), true);
    assert.equal(namesSubject("- **Surgery** is paid at $1,000.", "surgery", EN_WORDS), true);
    assert.equal(namesSubject("The hospital cash is $100 a day.", "The Hospital Cash", EN_WORDS), true);
    assert.equal(namesSubject("Hospital cash is $100 a day.", "the hospital cash", EN_WORDS), true);
  });

  it("a longer name, a name later in the sentence, or a word glued to the separator is not the subject", () => {
    assert.equal(namesSubject("入院給付金の上限は60万円です。", "入院給付金", JA_WORDS), false);
    assert.equal(namesSubject("当社は入院給付金として5,000円を支払います。", "入院給付金", JA_WORDS), false);
    assert.equal(namesSubject("Hospital cash cover is $100 a day.", "hospital cash", EN_WORDS), false);
    assert.equal(namesSubject("Surgery isolation costs $50.", "surgery", EN_WORDS), false);
    assert.equal(namesSubject("We pay hospital cash at $100.", "hospital cash", EN_WORDS), false);
    assert.equal(namesSubject("Hospital cash is $100.", "", EN_WORDS), false);
    assert.equal(namesSubject("", "hospital cash", EN_WORDS), false);
  });
});

const MARKS = [
  { pattern: "日額", group: "day" },
  { pattern: "月額", group: "month" },
  { pattern: "a day", group: "day" },
  { pattern: "per month", group: "month" },
];

const at = (source: string, written: string, key: string, unit: string): Amount => {
  const start = source.indexOf(written);
  return { start, end: start + written.length, kind: "quantity", key, unit };
};

describe("hasCondition", () => {
  it("a condition word anywhere in the sentence", () => {
    assert.equal(hasCondition("入院給付金は、集中治療室に入院した場合、1日につき15,000円をお支払いします。", ["場合", "とき"]), true);
    assert.equal(hasCondition("Hospital cash is paid at $150 a day if you are in intensive care.", ["if"]), true);
    assert.equal(hasCondition("Surgery other than cosmetic surgery is paid at $1,000.", ["if", "other than"]), true);
  });

  it("a condition word inside another word, or no condition word", () => {
    assert.equal(hasCondition("Hospital cash is paid at $150 for each day under the tariff.", ["if"]), false);
    assert.equal(hasCondition("入院給付金は、入院1日につき10,000円をお支払いします。", ["場合", "とき"]), false);
    assert.equal(hasCondition("Hospital cash is paid at $150.", []), false);
    assert.equal(hasCondition("", ["if"]), false);
  });
});

describe("periodOf", () => {
  it("a per-period mark right before or right after the amount", () => {
    const ja = "| 入院給付金 | 日額5,000円 |";
    assert.equal(periodOf(ja, at(ja, "5,000円", "5000", "円"), MARKS), "day");
    const en = "| Hospital cash | $100 a day |";
    assert.equal(periodOf(en, at(en, "$100", "100", "$"), MARKS), "day");
    const month = "Premium: $24 per month.";
    assert.equal(periodOf(month, at(month, "$24", "24", "$"), MARKS), "month");
  });

  it("no mark, or a mark that is not next to the amount", () => {
    const ja = "入院1日につき5,000円をお支払いします。";
    assert.equal(periodOf(ja, at(ja, "5,000円", "5000", "円"), MARKS), undefined);
    const en = "Hospital cash is paid at $100 for each day.";
    assert.equal(periodOf(en, at(en, "$100", "100", "$"), MARKS), undefined);
    const far = "a day later we paid $100.";
    assert.equal(periodOf(far, at(far, "$100", "100", "$"), MARKS), undefined);
    assert.equal(periodOf("", { start: 0, end: 0, kind: "quantity", key: "", unit: "" }, MARKS), undefined);
  });
});

const yen = (start: number, key: string, period?: string): Amount => ({
  start,
  end: start + 1,
  kind: "quantity",
  key,
  unit: "円",
  ...(period === undefined ? {} : { period }),
});
const row = (amounts: Amount[], scope = "s1", label = "入院給付金"): AmountRow => ({ label, scope, amounts });
const sentence = (amounts: Amount[], scope = "s1", text = "入院給付金は、入院1日につき10,000円をお支払いします。"): SubjectSentence => ({
  text,
  scope,
  amounts,
});
const values = (rows: AmountRow[], sentences: SubjectSentence[]): string[] =>
  rowSentenceConflicts(rows, sentences, JA_WORDS).map((conflict) => `${conflict.label}:${conflict.value.key}≠${conflict.other.key}`);

describe("rowSentenceConflicts", () => {
  it("the one amount of the row and the one amount of the sentence naming it", () => {
    assert.deepEqual(values([row([yen(1, "5000", "day")])], [sentence([yen(50, "10000")])]), ["入院給付金:10000≠5000"]);
    assert.deepEqual(values([row([yen(1, "5000")])], [sentence([yen(50, "5000")])]), []);
  });

  it("another scope, another subject, two rows of the name, or two amounts on either side are not compared", () => {
    assert.deepEqual(values([row([yen(1, "5000")], "s1")], [sentence([yen(50, "10000")], "s2")]), []);
    assert.deepEqual(values([row([yen(1, "5000")])], [sentence([yen(50, "10000")], "s1", "通院給付金は、10,000円です。")]), []);
    assert.deepEqual(values([row([yen(1, "5000")]), row([yen(5, "6000")])], [sentence([yen(50, "10000")])]), []);
    assert.deepEqual(values([row([yen(1, "5000"), yen(3, "600000")])], [sentence([yen(50, "10000")])]), []);
    assert.deepEqual(values([row([yen(1, "5000")])], [sentence([yen(50, "10000"), yen(60, "600000")])]), []);
    assert.deepEqual(values([], [sentence([yen(50, "10000")])]), []);
    assert.deepEqual(values([row([yen(1, "5000")])], []), []);
    assert.deepEqual(values([row([yen(1, "5000")])], [sentence([yen(50, "15000")], "s1", "入院給付金は、集中治療室に入院した場合、15,000円です。")]), []);
  });

  it("amounts for different periods, or in different currencies, are different values", () => {
    assert.deepEqual(values([row([yen(1, "5000", "day")])], [sentence([yen(50, "150000", "month")])]), []);
    const dollars: Amount = { start: 50, end: 54, kind: "quantity", key: "100", unit: "$" };
    assert.deepEqual(values([row([yen(1, "5000")])], [sentence([dollars])]), []);
  });
});

const RULES = { "fact-conflict": "normal" } as const;

const found = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === "fact-conflict")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const ja3 = (sentenceText: string, cell = "日額5,000円"): string =>
  [
    "# 給付の案内",
    "",
    "## 給付金",
    "",
    "| 給付金 | 支払額 | 支払限度 |",
    "| --- | --- | --- |",
    `| 入院給付金 | ${cell} | 1回の入院につき60日 |`,
    "| 手術給付金 | 1回50,000円 | 通算10回 |",
    "",
    sentenceText,
  ].join("\n");

const en2 = (sentenceText: string, heading = ""): string =>
  [
    "# Cover",
    "",
    "## What is covered",
    "",
    "| Cover | Sum insured |",
    "| --- | --- |",
    "| Medical expenses | $2,000,000 |",
    "| Baggage | $3,000 |",
    "",
    heading,
    "",
    sentenceText,
  ].join("\n");

describe("fact-conflict on a table row and a sentence naming it", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a benefit amount the sentence states differently (ja)", () => {
    assert.deepEqual(found(ja3("入院給付金は、入院1日につき10,000円をお支払いします。"), ja, "ja"), ["入院給付金:10,000円≠5,000円"]);
    assert.deepEqual(found(ja3("入院給付金は、入院1日につき5,000円をお支払いします。"), ja, "ja"), []);
  });

  it("a monthly cap against a daily amount, or a sentence about another benefit, is silent (ja)", () => {
    assert.deepEqual(found(ja3("入院給付金は、月額150,000円を限度にお支払いします。"), ja, "ja"), []);
    assert.deepEqual(found(ja3("通院給付金は、1日につき3,000円をお支払いします。"), ja, "ja"), []);
    assert.deepEqual(found(ja3("入院給付金は、日額5,000円、1回の入院につき300,000円を限度にお支払いします。"), ja, "ja"), []);
  });

  it("a sum insured the sentence states differently (en)", () => {
    assert.deepEqual(found(en2("Medical expenses are covered up to $5,000,000."), en, "en"), ["Medical expenses:$5,000,000≠$2,000,000"]);
    assert.deepEqual(found(en2("Medical expenses are covered up to $2,000,000."), en, "en"), []);
  });

  it("a sentence that puts a condition on its amount is silent (ja, en)", () => {
    assert.deepEqual(found(ja3("入院給付金は、集中治療室に入院した場合、1日につき10,000円をお支払いします。"), ja, "ja"), []);
    assert.deepEqual(found(en2("Medical expenses are covered up to $5,000,000 if you travel with a group."), en, "en"), []);
  });

  it("the sentence in another section, or with a longer subject, is silent (en)", () => {
    assert.deepEqual(found(en2("Medical expenses are covered up to $5,000,000.", "## Premium"), en, "en"), []);
    assert.deepEqual(found(en2("Medical expenses abroad are covered up to $5,000,000."), en, "en"), []);
  });
});
