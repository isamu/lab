import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { lowerCaseUses, nameBefore, quotedUses } from "../packages/chaff/src/detectors/defined-term-form.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A contract's defined terms in another form (quoted again, lower case), and a long name used again after its short
// name was defined. Every example is self-written.

const findingsOf = (adapter: LanguageAdapter, rule: string, source: string, genre = "legal/contract"): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, genre).findings.filter((finding) => finding.rule === rule);

const valuesOf = (adapter: LanguageAdapter, rule: string, source: string, key: string, genre?: string): string[] =>
  findingsOf(adapter, rule, source, genre).map((finding) => `${finding.variant ?? ""} ${String(finding.values[key])}`);

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const JA_TERMS = ["# 利用規約", "", "第1条\u3000当社は、会議室の予約サービス（以下「本サービス」という。）を提供する。", ""].join("\n");
const EN_TERMS = ["# Terms", "", '1. We provide a room booking service (the "Services").', ""].join("\n");

describe("defined-term-form: a defined term in another form", () => {
  it("reports a Japanese term quoted again after its definition", () => {
    const source = `${JA_TERMS}\n第2条\u3000利用者は、「本サービス」を業務の目的でだけ使う。\n\n第3条\u3000利用者は、本サービスを転売しない。\n`;
    assert.deepEqual(valuesOf(ja, "defined-term-form", source, "term"), ["quoted 本サービス"]);
  });

  it("reports an English term quoted again, and one written in lower case among capitalised uses", () => {
    const quoted = `${EN_TERMS}\n2. You may use the "Services" for business only.\n`;
    assert.deepEqual(valuesOf(en, "defined-term-form", quoted, "term"), ["quoted Services"]);
    assert.deepEqual(quotedUses('a "Services" b', "Service", [3], 0), [3]);
    const lower = `${EN_TERMS}\n2. You may use the Services for business. The Services are provided as is.\n\n3. You must not resell the services.\n`;
    assert.deepEqual(valuesOf(en, "defined-term-form", lower, "term"), ["case Services"]);
  });

  it("does not report a lower-case use that is the common form, or a capital at a sentence's start", () => {
    const common = `${EN_TERMS}\n2. Other services and services of others are not covered. The Services are separate.\n`;
    assert.deepEqual(valuesOf(en, "defined-term-form", common, "term"), []);
    const verb = [
      "# Terms",
      "",
      '1. Anything you send us (the "Input") stays yours.',
      "",
      "2. The Input is stored. The Input is deleted on request.",
      "",
      "3. Anything you input is checked.",
      "",
    ].join("\n");
    assert.deepEqual(valuesOf(en, "defined-term-form", verb, "term"), []);
    assert.deepEqual(lowerCaseUses("x. Services y Services. services z", "Services", [3, 14, 24], 0, 2), []);
    assert.deepEqual(lowerCaseUses("a Services b Services c services", "Services", [2, 13, 24], 0, 2), [24]);
  });

  it("does not count the definition, a use inside the defining sentence, or a second definition", () => {
    const defining = ["# Terms", "", '"Customer" means the party named as "Customer" on the Cover Page.', "", "The Customer pays.", ""].join("\n");
    assert.deepEqual(valuesOf(en, "defined-term-form", defining, "term"), []);
    assert.deepEqual(quotedUses("「甲」とは、甲をいう。", "甲", [1], 0), []);
    assert.deepEqual(quotedUses('x "Fee" has the meaning in 1.', "Fee", [3], 0), []);
    const inDefinition = [
      "# Terms",
      "",
      '"Services" means the support services we give. The Services include support.',
      "",
      "The Services are remote.",
      "",
    ].join("\n");
    assert.deepEqual(valuesOf(en, "defined-term-form", inDefinition, "term"), []);
  });

  it("does not run in a statute, which quotes a term to point at its definition", () => {
    const source = `${JA_TERMS}\n第2条\u3000「本サービス」の範囲は、別に定める。\n`;
    assert.deepEqual(findingsOf(ja, "defined-term-form", source, "legal/statute"), []);
  });
});

describe("defined-name-repeated: a long name used again after its short name", () => {
  const tokensOf = (adapter: LanguageAdapter, text: string) => adapter.segment(text).sentences[0];

  it("reads the name right before the definition's bracket", () => {
    const text = "株式会社みなと製作所（以下「甲」という。）と北浜商事株式会社（以下「乙」という。）は契約する。";
    const sentence = tokensOf(ja, text);
    assert.ok(sentence !== undefined);
    assert.equal(nameBefore(sentence, text.indexOf("（")), "株式会社みなと製作所");
    assert.equal(nameBefore(sentence, text.indexOf("（", text.indexOf("北浜"))), "北浜商事株式会社");
  });

  it("does not read a name narrowed by the words before it, or a short one", () => {
    const narrowed = "妊娠中の女性従業員（以下「妊産婦」という。）は休める。";
    const sentence = tokensOf(ja, narrowed);
    assert.ok(sentence !== undefined);
    assert.equal(nameBefore(sentence, narrowed.indexOf("（")), undefined);
    const english = 'You may test the Beta Preview (the "Purpose") only.';
    const englishSentence = tokensOf(en, english);
    assert.ok(englishSentence !== undefined);
    assert.equal(nameBefore(englishSentence, english.indexOf("(")), undefined);
  });

  const JA_PARTIES = [
    "# 業務委託契約書",
    "",
    "株式会社みなと製作所（以下「甲」という。）と北浜商事株式会社（以下「乙」という。）は、次のとおり契約を結ぶ。",
    "",
  ].join("\n");

  it("reports the long name used again, in both languages", () => {
    const source = `${JA_PARTIES}\n第1条\u3000乙は、株式会社みなと製作所の会議室の予約を代わりに行う。\n`;
    assert.deepEqual(valuesOf(ja, "defined-name-repeated", source, "term"), ["name 甲"]);
    const english = [
      "# Agreement",
      "",
      'This agreement is between Harbour Works Ltd (the "Supplier") and North Trading Inc (the "Customer").',
      "",
      "1. The Customer pays Harbour Works Ltd within thirty days.",
      "",
    ].join("\n");
    assert.deepEqual(valuesOf(en, "defined-name-repeated", english, "term"), ["name Supplier"]);
  });

  it("does not report a use before the definition, or a short name of a short word", () => {
    const earlier = [
      "# 契約書",
      "",
      "この契約の書式は、取引の始まる前に北浜商事株式会社の法務部が用意したものである。",
      "",
      "北浜商事株式会社（以下「乙」という。）は、次のとおり契約を結ぶ。",
      "",
    ].join("\n");
    assert.deepEqual(valuesOf(ja, "defined-name-repeated", earlier, "term"), []);
    const short = ["# 規約", "", "利用者（以下「ユーザー」という。）は、次に従う。", "", "第1条　利用者は、規約を守る。", ""].join("\n");
    assert.deepEqual(valuesOf(ja, "defined-name-repeated", short, "term"), []);
    const oneWord = ["# Terms", "", 'These terms are between you and Acme ("Supplier").', "", "1. Acme may change the terms.", ""].join("\n");
    assert.deepEqual(valuesOf(en, "defined-name-repeated", oneWord, "term"), []);
  });

  it("does not report a signature line, a line giving the short name, or the name inside a longer word", () => {
    const signed = `${JA_PARTIES}\n第1条\u3000乙は、甲の予約を行う。\n\n甲\u3000東京都千代田区一丁目 株式会社みなと製作所\n\n株式会社みなと製作所\n\n第2条\u3000株式会社みなと製作所大阪支店は対象外とする。\n`;
    assert.deepEqual(valuesOf(ja, "defined-name-repeated", signed, "term"), []);
  });
});
