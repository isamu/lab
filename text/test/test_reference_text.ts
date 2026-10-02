import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 参照に添えた名前と参照先の見出し（reference-title-mismatch）、参照に添えた話題と参照先の中身（reference-topic-missing）。

const RULES = { "reference-title-mismatch": "normal", "reference-topic-missing": "normal" } as const;

const found = (rule: string, source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "legal/contract")
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["name"] ?? finding.values["topic"])}≠${String(finding.values["heading"])}`);

const jaDoc = (line: string): string =>
  ["# 規約", "", "## 第1章 総則", "", line, "", "## 第2章 料金", "", "料金体系は月額です。", "", "## 第3章 返金", "", "返金は十日以内です。"].join("\n");
const enDoc = (line: string): string =>
  ["# Terms", "", "## 1. Scope", "", line, "", "## 2. Pricing", "", "The price is monthly.", "", "## 3. Refunds", "", "Refunds take ten days."].join("\n");

const titleJa = (line: string): string[] => found("reference-title-mismatch", jaDoc(line), ja, "ja");
const titleEn = (line: string): string[] => found("reference-title-mismatch", enDoc(line), en, "en");
const topicJa = (line: string): string[] => found("reference-topic-missing", jaDoc(line), ja, "ja");
const topicEn = (line: string): string[] => found("reference-topic-missing", enDoc(line), en, "en");

describe("reference-title-mismatch", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a name in brackets or quotes that is not the target's heading (ja)", () => {
    assert.deepEqual(titleJa("料金は第2章「返金」を見てください。"), ["第2章:返金≠料金"]);
    assert.deepEqual(titleJa("料金は第2章「料金」を、返金は第3章（返金）を見てください。"), []);
    assert.deepEqual(titleJa("返金は第3章（料金）を見てください。"), ["第3章:料金≠返金"]);
  });

  it("a name in brackets or quotes that is not the target's heading (en)", () => {
    assert.deepEqual(titleEn("For fees, see Section 2 (Refunds)."), ["Section 2:Refunds≠Pricing"]);
    assert.deepEqual(titleEn("For fees, see Section 2 (Pricing)."), []);
    assert.deepEqual(titleEn('For refunds, see Section 3 "Refunds and Returns".'), []);
  });

  it("a caption on an article in a contract", () => {
    const contract = (reference: string): string[] =>
      found(
        "reference-title-mismatch",
        [
          "# 契約書",
          "",
          "第1条（目的）",
          "本契約は取引を定める。",
          "",
          "第2条（秘密保持）",
          "乙は秘密を守る。",
          "",
          "第3条（損害賠償）",
          `${reference}に違反したときは賠償する。`,
        ].join("\n"),
        ja,
        "ja",
      );
    assert.deepEqual(contract("乙が第2条（損害賠償）"), ["第2条:損害賠償≠秘密保持"]);
    assert.deepEqual(contract("乙が第2条（秘密保持）"), []);
  });

  it("a number given to two articles points at neither", () => {
    const source = [
      "# 契約書",
      "",
      "第1条（目的）",
      "本契約は取引を定める。",
      "",
      "第2条（秘密保持）",
      "乙は秘密を守る。",
      "",
      "第2条（損害賠償）",
      "乙が第2条（目的）に違反したときは賠償する。",
    ];
    assert.deepEqual(found("reference-title-mismatch", source.join("\n"), ja, "ja"), []);
  });

  it("an Article reference does not resolve to a Section with the same number", () => {
    const source = [
      "# Act",
      "",
      "Section 6 Pricing",
      "Local pricing text.",
      "",
      "Section 7 Other",
      "Articles 13 to 21 of the UK GDPR apply. See Article 6 (Consent).",
    ];
    assert.deepEqual(found("reference-title-mismatch", source.join("\n"), en, "en"), []);
  });

  it("brackets that hold a number or an aside are not a name", () => {
    assert.deepEqual(titleEn("For fees, see Section 2 (above)."), []);
    assert.deepEqual(titleEn("For fees, see Section 2 (2024 edition)."), []);
    assert.deepEqual(titleJa("料金は第2章（前述）のとおりです。"), []);
    assert.deepEqual(titleEn("As in Section 2 (b) and Section 3(ii), fees apply."), []);
  });

  it("a reference to another document is not compared with this document's headings", () => {
    assert.deepEqual(titleJa("民法第2章（総則）に従います。"), []);
  });
});

describe("reference-topic-missing", () => {
  it("a topic the target never mentions (ja)", () => {
    assert.deepEqual(topicJa("第2章で述べた返金手続は改定されます。"), ["第2章:返金手続≠料金"]);
    assert.deepEqual(topicJa("第2章で述べた料金体系は改定されます。"), []);
  });

  it("a topic the target never mentions (en)", () => {
    assert.deepEqual(topicEn("See Section 2 for refunds."), ["Section 2:refunds≠Pricing"]);
    assert.deepEqual(topicEn("See Section 2 for pricing."), []);
    assert.deepEqual(topicEn("See Section 2 for prices."), []);
    assert.deepEqual(topicEn("See Section 2 for user data."), ["Section 2:user data≠Pricing"]);
    assert.deepEqual(topicEn("See Section 2 for monthly prices."), []);
    const inside = ["# Terms", "", "## 1. Scope", "", "See Section 2 for user data.", "", "## 2. Safety", "", "The abuser metadata is kept."].join("\n");
    assert.deepEqual(found("reference-topic-missing", inside, en, "en"), ["Section 2:user data≠Safety"]);
    assert.deepEqual(topicEn("See Section 3 for the refund window."), ["Section 3:refund window≠Refunds"]);
  });

  it("a word that fits any section is not a topic", () => {
    assert.deepEqual(topicEn("See Section 2 for details."), []);
    assert.deepEqual(topicEn("See Section 2 for more information."), []);
    assert.deepEqual(topicEn("See Section 2 for further caveats."), []);
    assert.deepEqual(topicJa("第2章で述べた内容は改定されます。"), []);
  });
});
