import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { termKeyOf, termValues, type TermValueWords } from "../packages/chaff/src/facts/term-values.ts";
import { documentTermConflicts, termHomes, type TermHome } from "../packages/chaff/src/facts/document-terms.ts";
import type { ScopedFact } from "../packages/chaff/src/facts/fact-scope.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import type { FactValue } from "../packages/chaff/src/facts/fact-values.ts";

// 文書全体で一つの値を持つ項目（保証期間）を主語にした文の期間と、項目の名前を見出しにした節の値。

const WORDS: TermValueWords = {
  terms: [
    { pattern: "保証期間", group: "warranty" },
    { pattern: "warranty period", group: "warranty" },
    { pattern: "warranty", group: "warranty" },
  ],
  separators: ["は", "は、", "is", "runs for"],
  determiners: ["the", "本体の"],
  selves: [
    { pattern: "本製品の", position: "before" },
    { pattern: "for the product", position: "after" },
  ],
  starts: [
    { pattern: "から", position: "before" },
    { pattern: "from", position: "after" },
  ],
  valueEnds: ["。", "です", ".", ","],
};

const at = (source: string, written: string, from = 0): { start: number; end: number } => {
  const start = source.indexOf(written, from);
  return { start, end: start + written.length };
};

const months = (source: string, written: string, amount: number, from = 0): FactValue => ({
  ...at(source, written, from),
  kind: "quantity",
  key: String(amount),
  unit: "month",
});

const date = (source: string, written: string, key: string, from = 0): FactValue => ({ ...at(source, written, from), kind: "date", key, unit: "" });

const read = (source: string, values: readonly FactValue[]): string[] =>
  termValues(source, values, WORDS).map((fact) => `${fact.key}=${source.slice(fact.value.start, fact.value.end)}`);

describe("termKeyOf: a lexicon item's name, with its determiner and the product's own name dropped", () => {
  it("names of the item", () => {
    assert.equal(termKeyOf("保証期間", WORDS), "保証期間");
    assert.equal(termKeyOf("本製品の保証期間", WORDS), "保証期間");
    assert.equal(termKeyOf("本体の保証期間", WORDS), "保証期間");
    assert.equal(termKeyOf("The warranty period for the product", WORDS), "warranty period");
    assert.equal(termKeyOf("the Warranty", WORDS), "warranty");
  });

  it("names of another item", () => {
    assert.equal(termKeyOf("延長保証期間", WORDS), undefined);
    assert.equal(termKeyOf("電池の保証期間", WORDS), undefined);
    assert.equal(termKeyOf("The warranty period for batteries", WORDS), undefined);
    assert.equal(termKeyOf("extended warranty", WORDS), undefined);
    assert.equal(termKeyOf("", WORDS), undefined);
  });
});

describe("termValues: a length stated for the item named as the subject", () => {
  it("a length after the phrase it counts from (ja)", () => {
    const source = "本製品の保証期間は、お買い上げ日から24か月です。";
    assert.deepEqual(read(source, [months(source, "24か月", 24)]), ["保証期間=24か月"]);
  });

  it("a length followed by the phrase it counts from (en)", () => {
    const source = "The warranty period for the product is 24 months from the date of purchase.";
    assert.deepEqual(read(source, [months(source, "24 months", 24)]), ["warranty period=24 months"]);
  });

  it("a length in brackets right after the name", () => {
    const ja1 = "保証期間（12か月）のうち、無料修理期間は、お買い上げ日から6か月です。";
    assert.deepEqual(read(ja1, [months(ja1, "12か月", 12), months(ja1, "6か月", 6)]), ["保証期間=12か月"]);
    const en1 = "Within the warranty period (12 months), parts are free.";
    assert.deepEqual(read(en1, [months(en1, "12 months", 12)]), []);
    const en2 = "Warranty period (12 months) covers parts.";
    assert.deepEqual(read(en2, [months(en2, "12 months", 12)]), ["warranty period=12 months"]);
  });

  it("a worked example: the condition only gives the date the length counts from", () => {
    const ja1 = "お買い上げ日が2026年7月1日の場合、保証期間は2026年7月1日から12か月（2027年6月30日まで）です。";
    const jaValues = [
      date(ja1, "2026年7月1日", "2026-07-01"),
      date(ja1, "2026年7月1日", "2026-07-01", 20),
      months(ja1, "12か月", 12),
      date(ja1, "2027年6月30日", "2027-06-30"),
    ];
    assert.deepEqual(read(ja1, jaValues), ["保証期間=12か月"]);
    const en1 = "If you bought the product on July 1, 2026, the warranty runs for 12 months from July 1, 2026 (until June 30, 2027).";
    const enValues = [
      date(en1, "July 1, 2026", "2026-07-01"),
      months(en1, "12 months", 12),
      date(en1, "July 1, 2026", "2026-07-01", 60),
      date(en1, "June 30, 2027", "2027-06-30"),
    ];
    assert.deepEqual(read(en1, enValues), ["warranty=12 months"]);
  });

  it("a condition that is not the start date is not read", () => {
    const ja1 = "製品登録をされた場合、保証期間は24か月です。";
    assert.deepEqual(read(ja1, [months(ja1, "24か月", 24)]), []);
    const ja2 = "お買い上げ日が2026年7月1日の場合、保証期間は2026年8月1日から24か月です。";
    assert.deepEqual(read(ja2, [date(ja2, "2026年7月1日", "2026-07-01"), date(ja2, "2026年8月1日", "2026-08-01"), months(ja2, "24か月", 24)]), []);
    const en1 = "If you register the product, the warranty runs for 24 months.";
    assert.deepEqual(read(en1, [months(en1, "24 months", 24)]), []);
    const en2 = "If you bought it before July 1, 2026, the warranty runs for 6 months from the date of purchase.";
    assert.deepEqual(read(en2, [date(en2, "July 1, 2026", "2026-07-01"), months(en2, "6 months", 6)]), []);
  });

  it("another subject, another item, or words after the length", () => {
    const ja1 = "無料修理期間は、お買い上げ日から6か月です。";
    assert.deepEqual(read(ja1, [months(ja1, "6か月", 6)]), []);
    const ja2 = "延長保証期間は、お買い上げ日から24か月です。";
    assert.deepEqual(read(ja2, [months(ja2, "24か月", 24)]), []);
    const ja3 = "保証期間は、お買い上げ日から6か月以内に申し出たときに延長します。";
    assert.deepEqual(read(ja3, [months(ja3, "6か月", 6)]), []);
    const en1 = "The warranty period is 12 months for batteries.";
    assert.deepEqual(read(en1, [months(en1, "12 months", 12)]), []);
    const en2 = "The warranty period for batteries is 6 months.";
    assert.deepEqual(read(en2, [months(en2, "6 months", 6)]), []);
  });

  it("only durations are read", () => {
    const source = "保証期間は2027年6月30日までです。";
    assert.deepEqual(read(source, [date(source, "2027年6月30日", "2027-06-30")]), []);
    assert.deepEqual(read("", []), []);
  });
});

describe("termHomes: a section whose heading is the item's name", () => {
  const words = { terms: WORDS.terms, determiners: ["the"] };

  it("headings that are the name", () => {
    assert.deepEqual(termHomes([{ heading: "保証期間", start: 10, end: 50 }], words), [{ group: "warranty", heading: "保証期間", start: 10, end: 50 }]);
    assert.deepEqual(termHomes([{ heading: "Warranty period", start: 0, end: 9 }], words), [
      { group: "warranty", heading: "Warranty period", start: 0, end: 9 },
    ]);
    assert.deepEqual(termHomes([{ heading: "The Warranty", start: 0, end: 9 }], words), [{ group: "warranty", heading: "The Warranty", start: 0, end: 9 }]);
  });

  it("headings that only contain the name", () => {
    assert.deepEqual(termHomes([{ heading: "保証期間の延長", start: 0, end: 9 }], words), []);
    assert.deepEqual(termHomes([{ heading: "What this warranty covers", start: 0, end: 9 }], words), []);
    assert.deepEqual(termHomes([{ heading: "", start: 0, end: 9 }], words), []);
  });
});

const RULES = { "fact-conflict": "normal" } as const;

const found = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "legal/contract")
    .findings.filter((finding) => finding.rule === "fact-conflict")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const jaDoc = (...lines: string[]): string[] => found(["# イヤホン 保証規定", "", ...lines].join("\n"), ja, "ja");
const enDoc = (...lines: string[]): string[] => found(["# Limited Warranty", "", ...lines].join("\n"), en, "en");

const HOME_JA = ["## 第2条（保証期間）", "", "保証期間（12か月）のうち、無料交換期間は、お買い上げ日から3か月です。", ""];
const HOME_EN = [
  "## 2. Warranty period",
  "",
  "If you bought the product on July 1, 2026, the warranty runs for 12 months from July 1, 2026 (until June 30, 2027).",
  "",
];

describe("fact-conflict: a warranty length stated two ways in one warranty", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("another section disagrees with the warranty-period section (ja, en)", () => {
    assert.deepEqual(jaDoc("## 第1条（保証の内容）", "", "本製品の保証期間は、お買い上げ日から24か月です。", "", ...HOME_JA), [
      "本製品の保証期間:24か月≠12か月",
    ]);
    assert.deepEqual(jaDoc("## 第1条（保証の内容）", "", "本製品の保証期間は、お買い上げ日から2年です。", "", ...HOME_JA), ["本製品の保証期間:2年≠12か月"]);
    assert.deepEqual(
      enDoc("## 1. What this warranty covers", "", "The warranty period for the product is 24 months from the date of purchase.", "", ...HOME_EN),
      ["The warranty period for the product:24 months≠12 months"],
    );
  });

  it("a year and twelve months agree (ja, en)", () => {
    assert.deepEqual(jaDoc("## 第1条（保証の内容）", "", "本製品の保証期間は、お買い上げ日から1年です。", "", ...HOME_JA), []);
    assert.deepEqual(
      enDoc("## 1. What this warranty covers", "", "The warranty period for the product is 1 year from the date of purchase.", "", ...HOME_EN),
      [],
    );
  });

  it("a free-repair period inside the warranty and an extended warranty are other items", () => {
    assert.deepEqual(jaDoc("## 第1条（保証の内容）", "", "無料修理期間は、お買い上げ日から6か月です。", "", ...HOME_JA), []);
    assert.deepEqual(jaDoc("## 第1条（延長保証）", "", "延長保証の期間は、お買い上げ日から2年です。", "", ...HOME_JA), []);
    assert.deepEqual(enDoc("## 1. Extended warranty", "", "The extended warranty runs for 24 months from the date of purchase.", "", ...HOME_EN), []);
  });

  it("a length under a condition is not the item's value", () => {
    assert.deepEqual(jaDoc("## 第1条（製品登録）", "", "製品登録をされた場合、保証期間は24か月です。", "", ...HOME_JA), []);
    assert.deepEqual(enDoc("## 1. Registration", "", "If you register the product, the warranty runs for 24 months.", "", ...HOME_EN), []);
  });

  it("sections per part, with no section for the item, stay apart", () => {
    assert.deepEqual(jaDoc("## 本体", "", "本体の保証期間は、お買い上げ日から1年です。", "", "## 電池", "", "保証期間は、お買い上げ日から6か月です。"), []);
  });

  it("a month and thirty days are not compared", () => {
    assert.deepEqual(
      jaDoc("## 第1条（保証の内容）", "", "本製品の保証期間は、お買い上げ日から30日です。", "", "## 第2条（保証期間）", "", "保証期間（1か月）は無料です。"),
      [],
    );
  });

  it("the message names the section the other value is in", () => {
    const source = ["# 保証規定", "", "## 第1条（保証の内容）", "", "本製品の保証期間は、お買い上げ日から24か月です。", "", ...HOME_JA].join("\n");
    const rules = loadRules("ja");
    const rule = rules.find((candidate) => candidate.id === "fact-conflict");
    assert.ok(rule);
    const findings = runRules(buildDocument("t.md", source, ja), rules, RULES, false, "legal/contract").findings.filter(
      (finding) => finding.rule === "fact-conflict",
    );
    assert.deepEqual(
      findings.map((finding) => [finding.variant, finding.values["section"], messageOf(rule, finding, "ja")]),
      [["term-section", "保証期間", "「本製品の保証期間」が 24か月 と書かれていますが、「保証期間」の節では 12か月 です"]],
    );
  });
});

const sentence = (key: string, amount: number, start: number, scope: string, extra: Partial<ScopedFact> = {}): ScopedFact => ({
  label: key,
  key,
  value: { start, end: start + 2, kind: "quantity", key: String(amount), unit: "month" },
  scope,
  part: "body",
  record: false,
  ...extra,
});

const TERM_WORDS = { terms: [{ pattern: "保証期間", group: "warranty" }], determiners: [] };
const HOME: TermHome = { group: "warranty", heading: "保証期間", start: 100, end: 200 };

const homeConflicts = (facts: readonly ScopedFact[], homes: readonly TermHome[]): string[] =>
  documentTermConflicts(facts, TERM_WORDS, homes).map(({ fact, other, section }) => `${fact.scope}:${fact.value.key}≠${other.key}@${section ?? "table"}`);

describe("documentTermConflicts: the section headed by the item's name is a source like a table cell", () => {
  it("a sentence elsewhere that disagrees with the section's value", () => {
    assert.deepEqual(homeConflicts([sentence("保証期間", 24, 10, "s1"), sentence("保証期間", 12, 120, "s2")], [HOME]), ["s1:24≠12@保証期間"]);
    assert.deepEqual(homeConflicts([sentence("保証期間", 12, 120, "s2"), sentence("保証期間", 24, 300, "s3")], [HOME]), ["s3:24≠12@保証期間"]);
  });

  it("a table cell is named as the source when there is one", () => {
    const cell = sentence("保証期間", 12, 120, "s2", { table: true });
    assert.deepEqual(homeConflicts([sentence("保証期間", 24, 10, "s1"), cell], [HOME]), ["s1:24≠12@table"]);
  });

  it("agreeing values, a section of another item, two values in the section, or no section", () => {
    assert.deepEqual(homeConflicts([sentence("保証期間", 12, 10, "s1"), sentence("保証期間", 12, 120, "s2")], [HOME]), []);
    assert.deepEqual(homeConflicts([sentence("保証期間", 24, 10, "s1"), sentence("保証期間", 12, 120, "s2")], [{ ...HOME, group: "other" }]), []);
    const twoInSection = [sentence("保証期間", 24, 10, "s1"), sentence("保証期間", 12, 120, "s2"), sentence("保証期間", 24, 150, "s2")];
    assert.deepEqual(homeConflicts(twoInSection, [HOME]), []);
    assert.deepEqual(homeConflicts([sentence("保証期間", 24, 10, "s1"), sentence("保証期間", 12, 120, "s2")], []), []);
  });
});
