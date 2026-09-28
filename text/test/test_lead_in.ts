import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLeadIn } from "../packages/chaff/src/detectors/lead-in.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 後ろの箇条書きへ読者を渡す文は、見出しの語を繰り返していても heading-echo ではない。中身は後ろにある。

const JA = ["次のとおり", "以下のとおり"];
const EN = ["as follows", "listed below"];

describe("isLeadIn", () => {
  const leadIns: readonly (readonly [string, readonly string[]])[] = [
    ["The following expenses require receipts:", EN],
    ["We also collect some information automatically:", EN],
    ["`BufferManager` maintains the following constants:  ", EN],
    ["**Examples:**", EN],
    ["_Examples:_", EN],
    ["The fees are as follows.", EN],
    ["The Fees Are As Follows.", EN],
    ["We use information about you for the purposes listed below.", EN],
    ["対象者：", JA],
    ["始業・終業の時刻は、次のとおりとする。", JA],
    ["出張旅費の支給基準は、次のとおり出張の区分に応じる。", JA],
    ["手順は以下のとおりです。", JA],
    ["Contents:", []],
  ];
  leadIns.forEach(([sentence, phrases]) => {
    it(`hands over: ${JSON.stringify(sentence)}`, () => assert.equal(isLeadIn(sentence, phrases), true));
  });

  const others: readonly (readonly [string, readonly string[]])[] = [
    ["Switch the workspace.", EN],
    ["Note: the API is deprecated.", EN],
    ["We met the following day.", EN],
    ["Use the follow-up form as needed.", EN],
    ["ワークスペースを切り替えます。", JA],
    ["注意：この API は廃止予定です。", JA],
    ["次の会議で決めます。", JA],
    ["The fees are as follows.", []],
    ["次のとおりとする。", EN],
    ["", EN],
    ["   ", JA],
    ["Anything at all.", [""]],
  ];
  others.forEach(([sentence, phrases]) => {
    it(`does not hand over: ${JSON.stringify(sentence)} with ${JSON.stringify(phrases)}`, () => assert.equal(isLeadIn(sentence, phrases), false));
  });
});

const echoes = (source: string, adapter: LanguageAdapter): number => {
  const doc = buildDocument("a.md", source, adapter);
  return runRules(doc, loadRules(adapter.id), {}, false, "technical/readme").findings.filter((finding) => finding.rule === "heading-echo").length;
};

describe("heading-echo and a sentence that hands over to a list", () => {
  it("still reports a heading repeated by a plain sentence", () => {
    assert.equal(echoes("## Expenses requiring receipts\n\nSome expenses require receipts.\n\n- Hotels\n- Rental cars\n", en), 1);
    assert.equal(echoes("## 旅費の支給基準\n\n旅費の支給基準を定める。\n\n1. 日当\n2. 宿泊料\n", ja), 1);
  });

  it("leaves a sentence ending with a colon alone", () => {
    assert.equal(echoes("## Expenses requiring receipts\n\nThe following expenses require receipts:\n\n- Hotels\n- Rental cars\n", en), 0);
    assert.equal(echoes("## 旅費の支給基準\n\n旅費の支給基準：\n\n1. 日当\n2. 宿泊料\n", ja), 0);
  });

  it("leaves a sentence with the language's hand-over phrase alone", () => {
    assert.equal(echoes("## Expenses requiring receipts\n\nThe expenses requiring receipts are as follows.\n\n- Hotels\n- Rental cars\n", en), 0);
    assert.equal(echoes("## 旅費の支給基準\n\n旅費の支給基準は、次のとおりとする。\n\n1. 日当\n2. 宿泊料\n", ja), 0);
  });

  it("does not take another language's phrase", () => {
    assert.equal(echoes("## 旅費の支給基準\n\n旅費の支給基準は as follows とする。\n\n1. 日当\n", ja), 1);
  });

  it("each language carries the lexicon", () => {
    assert.ok((ja.lexicons["lead-in"] ?? []).length > 0);
    assert.ok((en.lexicons["lead-in"] ?? []).length > 0);
  });
});
