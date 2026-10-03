// @ts-check
// chaff-plugin-legal-contract のルールの単体テスト。chaff 本体を走らせずに、detector を直接呼んで検証する。

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import plugin from "../index.mjs";
import { partyAliasMix } from "../rules/party-alias-mix.mjs";
import { requiredClausesNda } from "../rules/required-clauses-nda.mjs";
import { monoToSuruFiller } from "../rules/mono-to-suru-filler.mjs";

/** @import { RuleDocument } from "chaffjs/api" */

/**
 * @param {string} source
 * @returns {RuleDocument}
 */
const documentOf = (source) => {
  const lines = source.split("\n");
  const sentences = lines
    .filter((line) => line.trim().length > 0)
    .map((text, index, filtered) => {
      const prefix = filtered.slice(0, index).join("\n");
      const start = prefix.length + (index === 0 ? 0 : 1);
      return { span: { start, end: start + text.length }, text };
    });
  return {
    path: "test.md",
    source,
    language: "ja",
    lengthUnit: "char",
    sentences,
    paragraphs: [],
    sections: [],
    lists: [],
    listItems: [],
    links: [],
    lexicons: {},
    markup: { markdown: false, headings: [], images: [], links: [], ids: [], texts: [] },
  };
};

describe("plugin shape", () => {
  it("has name legal-contract", () => {
    assert.equal(plugin.name, "legal-contract");
  });
  it("ships 3 rules", () => {
    assert.equal(plugin.rules.length, 3);
  });
  it("ships 1 style", () => {
    assert.equal(plugin.styles?.length, 1);
  });
});

describe("party-alias-mix", () => {
  it("flags when 甲 and 委託者 are both used", () => {
    const doc = documentOf("甲は乙に業務を委託する。\n委託者は受託者に対して報告を求めることができる。");
    const findings = partyAliasMix(doc, { lexicon: [] });
    assert.ok(findings.length >= 1, "mixed aliases should be flagged");
  });

  it("does not flag when only 甲 is used", () => {
    const doc = documentOf("甲は乙に業務を委託する。\n甲は乙に対して報告を求めることができる。");
    const findings = partyAliasMix(doc, { lexicon: [] });
    assert.equal(findings.length, 0);
  });

  it("does not flag when only 委託者 is used", () => {
    const doc = documentOf("委託者は受託者に業務を委託する。\n委託者は受託者に対して報告を求める。");
    const findings = partyAliasMix(doc, { lexicon: [] });
    assert.equal(findings.length, 0);
  });
});

describe("required-clauses-nda", () => {
  it("flags all missing clauses on empty document", () => {
    const doc = documentOf("秘密保持契約書\n\n甲と乙は秘密を守る。");
    const findings = requiredClausesNda(doc, { lexicon: [] });
    assert.ok(findings.length >= 7, `should flag many missing clauses, got ${findings.length}`);
  });

  it("does not flag when all keywords present", () => {
    const fullNda = `
秘密保持契約書
本契約において「秘密情報」とは、相手方から開示された情報をいう。
乙は、秘密情報を本目的のためにのみ使用する。
乙は、秘密情報を第三者に開示しない。
乙は、本契約が終了したときは、秘密情報を返還し、または廃棄する。
本契約の有効期間は 1 年とする。
本契約が終了した後も、秘密保持義務は 3 年間存続する。
乙が本契約に違反したときは、損害賠償を負う。
本契約は日本法に準拠する。
本契約に関する紛争は、東京地方裁判所を専属的合意管轄裁判所とする。
    `.trim();
    const doc = documentOf(fullNda);
    const findings = requiredClausesNda(doc, { lexicon: [] });
    assert.equal(findings.length, 0, "a full NDA should pass");
  });
});

describe("mono-to-suru-filler", () => {
  it("flags 「報告するものとする」", () => {
    const doc = documentOf("甲は、乙に対し、業務の進捗状況を毎月報告するものとする。");
    const findings = monoToSuruFiller(doc, { lexicon: [] });
    assert.equal(findings.length, 1);
  });

  it("does not flag plain 「報告する」", () => {
    const doc = documentOf("甲は、乙に対し、業務の進捗状況を毎月報告する。");
    const findings = monoToSuruFiller(doc, { lexicon: [] });
    assert.equal(findings.length, 0);
  });

  it("flags multiple occurrences across sentences", () => {
    const doc = documentOf("甲は毎月報告するものとする。\n乙は年次で確認するものとする。");
    const findings = monoToSuruFiller(doc, { lexicon: [] });
    assert.equal(findings.length, 2);
  });

  it("does not match 「ものとし、」 (連用形)", () => {
    const doc = documentOf("甲は報告するものとし、乙は確認する。");
    const findings = monoToSuruFiller(doc, { lexicon: [] });
    assert.equal(findings.length, 0);
  });
});
