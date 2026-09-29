import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withoutQuotedVariants } from "../packages/chaff/src/detectors/quoted-variant.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 表記の手引きや用語集の項目は、見出しの語の別の書き方を引用して示す（Not “datacentre”.）。引用は言及で、見出しの繰り返しではない。
// 英語の例は GOV.UK の A to Z of GOV.UK style（OGL v3.0）から、日本語の例は自作。

describe("withoutQuotedVariants", () => {
  const dropped: readonly (readonly [string, string, string])[] = [
    ["Not “datacentre”.", "data centre", "Not  ."],
    ["Not ‘the disabled’ or ‘people with disabilities’.", "disabled people", "Not   or  ."],
    ['Not "change log".', "changelog", "Not  ."],
    ["Not 'check box'.", "checkbox", "Not  ."],
    ["When talking about software, not “migrate over”.", "migrate", "When talking about software, not  ."],
    ["「親機」とも呼ばれます。", "アクセスポイント", " とも呼ばれます。"],
    ["『利用の手引』を読んでください。", "利用方法", " を読んでください。"],
    ["Use lower case for both ‘public limited company’ and ‘plc’.", "public limited company (plc)", "Use lower case for both   and  ."],
    ["Not ‘the team’s rota’.", "rota", "Not  ."],
    ["Not “Open Source software” or “OS software”.", "open source software", "Not   or  ."],
    ["The users' 'data' flag.", "flag", "The users'   flag."],
  ];
  dropped.forEach(([sentence, heading, expected]) => {
    it(`drops a quoted variant: ${sentence}`, () => assert.equal(withoutQuotedVariants(sentence, heading), expected));
  });

  const kept: readonly (readonly [string, string])[] = [
    ["「利用規約への同意」へお進みください。", "利用規約への同意"],
    ["“Caching” is how we keep pages fast.", "Caching"],
    ["「 利用規約への同意 」へお進みください。", "利用規約への同意"],
    ["Use ‘WhatsApp’ with an upper case A.", "WhatsApp"],
    ["Your organisation’s lead can send a ticket.", "organisation"],
    ["Avoid contractions like can't and don't.", "contractions"],
    ["The team's rota is on the wiki.", "rota"],
    ["A “quote that never closes.", "quote"],
    ["The ‘Chair’s view never closes.", "view"],
    ["A 'quote with the team's rota.", "rota"],
    ["「閉じない括弧です。", "括弧"],
    ["", "anything"],
  ];
  kept.forEach(([sentence, heading]) => {
    it(`keeps: ${JSON.stringify(sentence)}`, () => assert.equal(withoutQuotedVariants(sentence, heading), sentence));
  });

  it("does not reach across lines for a closing quote", () => {
    assert.equal(withoutQuotedVariants("A “start\nand” end", "x"), "A “start\nand” end");
  });
});

const echoes = (source: string, adapter: LanguageAdapter): number => {
  const doc = buildDocument("a.md", source, adapter);
  return runRules(doc, loadRules(adapter.id), {}, false, "business/report").findings.filter((finding) => finding.rule === "heading-echo").length;
};

describe("heading-echo and a quoted variant of the heading", () => {
  it("valid: a style entry that quotes other spellings of its term", () => {
    assert.equal(echoes("## data centre\n\nNot “datacentre”.\n", en), 0);
    assert.equal(echoes("## zero-hours contract\n\nNot “zero-hour contract” or “zero hours contract”.\n", en), 0);
    assert.equal(echoes("## disabled people\n\nNot ‘the disabled’ or ‘people with disabilities’.\n", en), 0);
    assert.equal(echoes("## 利用者登録の手続\n\n「利用登録の手続」「登録手続」とは書かない。\n", ja), 0);
  });

  it("invalid: the same entry that repeats its term outside quotes", () => {
    assert.equal(echoes("## data centre\n\nThe data centre.\n", en), 1);
    assert.equal(echoes("## zero-hours contract\n\nA zero-hours contract.\n", en), 1);
    assert.equal(echoes("## 利用者登録の手続\n\n利用者登録の手続とは書かない。\n", ja), 1);
  });

  it("invalid: a sentence that quotes the heading itself still repeats it", () => {
    assert.equal(echoes("## 利用規約への同意\n\n「利用規約への同意」について。\n", ja), 1);
    assert.equal(echoes("## Suggest a change\n\nThis is “Suggest a change”.\n", en), 1);
  });
});
