import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { qualifiedKeyOf, qualifiedKeys, qualifiedLabelOf, type QualifierWords } from "../packages/chaff/src/facts/qualified-labels.ts";

// 条件の付いた名前: 「待機期間（旅行キャンセル費用）」=「旅行キャンセル費用の待機期間」、"waiting period (cancellation cover)" =
// "waiting period for cancellation cover"。条件の違う名前と、条件の無い名前は別の名前。

const JA: QualifierWords = { templates: ["（*）", "*の"], determiners: ["本体の", "製品の"] };
const EN: QualifierWords = { templates: ["(*)", "for *"], determiners: ["the", "a", "an", "our", "your"] };

const label = (key: string, words: QualifierWords): string => {
  const found = qualifiedLabelOf(key, words);
  return found === undefined ? "-" : `${found.head}|${found.qualifier}`;
};

describe("qualifiedLabelOf: a name and its qualifier", () => {
  it("a bracket and a joiner give the same name and qualifier (ja)", () => {
    assert.equal(label("待機期間(旅行キャンセル費用)", JA), "待機期間|旅行キャンセル費用");
    assert.equal(label("待機期間（旅行キャンセル費用）", JA), "待機期間|旅行キャンセル費用");
    assert.equal(label("旅行キャンセル費用の待機期間", JA), "待機期間|旅行キャンセル費用");
  });

  it("a bracket and for / of give the same name and qualifier (en)", () => {
    assert.equal(label("waiting period (cancellation cover)", EN), "waiting period|cancellation cover");
    assert.equal(label("waiting period for cancellation cover", EN), "waiting period|cancellation cover");
    assert.equal(label("waiting period for the cancellation cover", EN), "waiting period|cancellation cover");
    assert.equal(label("the waiting period (cancellation cover)", EN), "waiting period|cancellation cover");
    assert.equal(label("terms of service", EN), "-");
  });

  it("several joiners: ja keeps the last の's tail as the name, en the first for's head", () => {
    assert.equal(label("海外旅行の取消しの待機期間", JA), "待機期間|海外旅行の取消し");
    assert.equal(label("fee for cancellation for groups", EN), "fee|cancellation for groups");
  });

  it("a name with no qualifier, or with only one side, is not split", () => {
    assert.equal(label("待機期間", JA), "-");
    assert.equal(label("waiting period", EN), "-");
    assert.equal(label("の待機期間", JA), "-");
    assert.equal(label("待機期間の", JA), "-");
    assert.equal(label("(cancellation cover)", EN), "-");
    assert.equal(label("waiting period ()", EN), "-");
    assert.equal(label("waiting period for", EN), "-");
    assert.equal(label("waiting period for the", EN), "-");
    assert.equal(label("", EN), "-");
  });

  it("a joiner inside a word is not a joiner (en)", () => {
    assert.equal(label("format fee", EN), "-");
    assert.equal(label("offer of", EN), "-");
    assert.equal(label("platform fees", EN), "-");
  });

  it("a template with no placeholder, or a placeholder alone, reads nothing", () => {
    assert.equal(label("待機期間(疾病)", { templates: ["（）", "*"], determiners: [] }), "-");
    assert.equal(label("待機期間(疾病)", { templates: [], determiners: [] }), "-");
  });
});

describe("qualifiedKeyOf and qualifiedKeys: one key per name and qualifier", () => {
  it("the two ways of writing one qualified name share a key", () => {
    assert.equal(qualifiedKeyOf("待機期間(旅行キャンセル費用)", JA), qualifiedKeyOf("旅行キャンセル費用の待機期間", JA));
    assert.equal(qualifiedKeyOf("waiting period (cancellation cover)", EN), qualifiedKeyOf("waiting period for cancellation cover", EN));
  });

  it("different qualifiers, and no qualifier, keep different keys", () => {
    assert.notEqual(qualifiedKeyOf("待機期間(疾病)", JA), qualifiedKeyOf("待機期間(けが)", JA));
    assert.notEqual(qualifiedKeyOf("疾病の待機期間", JA), qualifiedKeyOf("待機期間(けが)", JA));
    assert.notEqual(qualifiedKeyOf("待機期間(疾病)", JA), "待機期間");
    assert.equal(qualifiedKeyOf("待機期間", JA), "待機期間");
    assert.notEqual(qualifiedKeyOf("waiting period for illness", EN), qualifiedKeyOf("waiting period (injury)", EN));
  });

  it("a qualifier written before the name joins only a name the document also qualifies another way (en)", () => {
    const keys = qualifiedKeys(["waiting period (cancellation cover)", "cancellation cover waiting period", "waiting period"], EN);
    assert.equal(keys[1], keys[0]);
    assert.equal(keys[2], "waiting period");
    assert.deepEqual(qualifiedKeys(["cancellation cover waiting period"], EN), ["cancellation cover waiting period"]);
  });

  it("a qualifier written before the name that two qualified names could give joins neither", () => {
    assert.deepEqual(qualifiedKeys(["claim limit (baggage)", "limit (baggage claim)", "baggage claim limit"], EN), [
      "claim limit (baggage)",
      "limit (baggage claim)",
      "baggage claim limit",
    ]);
  });

  it("a qualifier with an article or a joiner in it is not read before the name", () => {
    const keys = qualifiedKeys(["fee for cancellation of a trip", "cancellation of a trip fee"], EN);
    assert.notEqual(keys[1], keys[0]);
    assert.deepEqual(qualifiedKeys(["待機期間(疾病)", "疾病 待機期間"], JA), ["待機期間 (疾病)", "疾病 待機期間"]);
  });
});

const RULES = { "fact-conflict": "normal" } as const;

const found = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === "fact-conflict")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const conflictJa = (...lines: string[]): string[] => found(["# 重要事項説明書", "", "前書き。", "", "## 保険期間", "", ...lines].join("\n"), ja, "ja");
const conflictEn = (...lines: string[]): string[] => found(["# Key facts", "", "Introduction.", "", "## Period of cover", "", ...lines].join("\n"), en, "en");

const TABLE_JA = ["| 項目 | 内容 |", "| --- | --- |"];
const TABLE_EN = ["| Item | Details |", "| --- | --- |"];

describe("fact-conflict: a table's qualified name and a sentence's", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a bracket in the table and の in the sentence (ja)", () => {
    assert.deepEqual(conflictJa(...TABLE_JA, "| 待機期間（旅行キャンセル費用） | 7日 |", "", "旅行キャンセル費用の待機期間は14日です。"), [
      "旅行キャンセル費用の待機期間:14日≠7日",
    ]);
  });

  it("a bracket in the table and for in the sentence (en)", () => {
    assert.deepEqual(conflictEn(...TABLE_EN, "| Waiting period (cancellation cover) | 7 days |", "", "The waiting period for cancellation cover is 14 days."), [
      "The waiting period for cancellation cover:14 days≠7 days",
    ]);
  });

  it("a qualifier written before the name, when the table qualifies it (en)", () => {
    assert.deepEqual(conflictEn(...TABLE_EN, "| Excess (baggage) | $100 |", "", "The baggage excess is $150."), ["The baggage excess:$150≠$100"]);
    assert.deepEqual(conflictEn(...TABLE_EN, "| Excess | $100 |", "", "The baggage excess is $150."), []);
  });

  it("a qualified name is measured as a name and a qualifier, each as short as one name", () => {
    assert.deepEqual(
      conflictEn(
        ...TABLE_EN,
        "| Waiting period (cancellation cover) | 7 days |",
        "",
        "The waiting period for cancellation cover bought online before departure is 14 days.",
      ),
      [],
    );
  });

  it("the same value written both ways agrees", () => {
    assert.deepEqual(conflictJa(...TABLE_JA, "| 待機期間（旅行キャンセル費用） | 7日 |", "", "旅行キャンセル費用の待機期間は7日です。"), []);
    assert.deepEqual(
      conflictEn(...TABLE_EN, "| Waiting period (cancellation cover) | 7 days |", "", "The waiting period for cancellation cover is 7 days."),
      [],
    );
  });

  it("different qualifiers are different items", () => {
    assert.deepEqual(conflictJa(...TABLE_JA, "| 待機期間（疾病） | 30日 |", "", "けがの待機期間は14日です。"), []);
    assert.deepEqual(conflictEn(...TABLE_EN, "| Waiting period (illness) | 30 days |", "", "The waiting period for injury is 14 days."), []);
  });

  it("a name with no qualifier is not the qualified item, even when it is the only other name", () => {
    assert.deepEqual(conflictJa(...TABLE_JA, "| 待機期間（疾病） | 30日 |", "", "待機期間は14日です。"), []);
    assert.deepEqual(conflictEn(...TABLE_EN, "| Waiting period (illness) | 30 days |", "", "The waiting period is 14 days."), []);
  });
});
