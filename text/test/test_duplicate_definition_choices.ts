import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { namesOneChoice } from "../packages/chaff/src/structure/alternative-clause.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// duplicate-definition: a model contract sets out ways to write one clause (第1条（オプション1：…）, (Option B)) for one to be
// chosen. A definition inside a choice goes when another is chosen, so a later definition of the same term is not a sure
// second one. Self-written text in the shape of the 特許庁 OI model contracts.

const duplicatesOf = (adapter: LanguageAdapter, source: string): [unknown, unknown][] =>
  runRules(buildDocument("c.md", source, adapter), loadRules(adapter.id), {}, true, "legal/contract")
    .findings.filter((finding) => finding.rule === "duplicate-definition")
    .map((finding) => [finding.values["term"], finding.line]);

const ja1 = "第1条（オプション1：範囲を限らない）";
const ja2 = "第1条（オプション2：秘密と示したもの）";
const DEFINE_1 = "「秘密情報」とは、開示者が受領者に開示した一切の情報をいう。";
const DEFINE_2 = "「秘密情報」とは、開示者が秘密と示して開示した情報をいう。";
const contractJa = (...lines: string[]): string =>
  ["# 秘密保持契約書", "", ...lines, "", "第2条（秘密保持）", "受領者は、秘密情報を秘密に保つ。", ""].join("\n");

describe("duplicate-definition: definitions in clauses to choose from", () => {
  it("does not report the same term defined in each of the numbered choices", () => {
    assert.deepEqual(duplicatesOf(ja, contractJa(ja1, DEFINE_1, "", ja2, DEFINE_2)), []);
  });

  it("does not report a clause kept whichever is chosen that defines a term a choice defined before it", () => {
    const shared = contractJa(
      ja1,
      DEFINE_1,
      "",
      ja2,
      "書面または電磁的記録（以下「書面等」という。）で開示した情報を秘密情報とする。",
      "",
      "第1条2項（開示の方法）【オプション1～2共通】",
      "書面または電磁的記録（以下「書面等」という。）で示す。",
    );
    assert.deepEqual(duplicatesOf(ja, shared), []);
  });

  it("still reports a term defined twice within one choice, and a choice that defines again a term the kept text defined", () => {
    assert.deepEqual(duplicatesOf(ja, contractJa(ja1, DEFINE_1, DEFINE_2, "", ja2, DEFINE_2)), [["秘密情報", 5]]);
    assert.deepEqual(duplicatesOf(ja, contractJa("第1条（定義）", DEFINE_1, "", ja2, DEFINE_2)), [["秘密情報", 7]]);
  });

  it("still reports the same term defined twice where no clause is named a choice", () => {
    assert.deepEqual(duplicatesOf(ja, contractJa("第1条（定義）", DEFINE_1, "", "第2条（範囲）", DEFINE_2)), [["秘密情報", 7]]);
  });

  it("reads English choices the same way", () => {
    const contractEn = (first: string, second: string): string =>
      [
        "# Confidentiality Agreement",
        "",
        `## 1. ${first}`,
        "",
        '"Confidential Information" means all information the Discloser gives the Recipient.',
        "",
        `## 2. ${second}`,
        "",
        '"Confidential Information" means information the Discloser marks as confidential.',
        "",
      ].join("\n");
    assert.deepEqual(duplicatesOf(en, contractEn("Scope (Option A)", "Scope (Option B)")), []);
    assert.deepEqual(duplicatesOf(en, contractEn("Scope", "Marked information")), [["Confidential Information", 9]]);
  });
});

describe("namesOneChoice", () => {
  it("names one choice: the word and one number or letter", () => {
    assert.equal(namesOneChoice("（オプション2：秘密情報の範囲）", ["オプション"]), true);
    assert.equal(namesOneChoice("Scope (Option B)", ["Option"]), true);
    assert.equal(namesOneChoice("選択肢３", ["選択肢"]), true);
  });

  it("does not name a choice in a range, a list, a word without a number or another word", () => {
    assert.equal(namesOneChoice("【オプション1～3共通】", ["オプション"]), false);
    assert.equal(namesOneChoice("Options A and B", ["Option"]), false);
    assert.equal(namesOneChoice("Option A and B", ["Option"]), false);
    assert.equal(namesOneChoice("Option 1-3", ["Option"]), false);
    assert.equal(namesOneChoice("Option to Purchase", ["Option"]), false);
    assert.equal(namesOneChoice("Option Agreement", ["Option"]), false);
    assert.equal(namesOneChoice("第5条（オプション料）", ["オプション"]), false);
    assert.equal(namesOneChoice("", ["オプション"]), false);
    assert.equal(namesOneChoice("オプション1", [""]), false);
  });
});
