import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// doubled-word: the same particle on both sides of a parenthetical aside (本規約は(以下、規約)は), left over when the
// aside was added. All text is self-written.

const findingsOf = (source: string, genre = "business/report", adapter = ja, language: "ja" | "en" = "ja"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), {}, true, genre)
    .findings.filter((finding) => finding.rule === "doubled-word")
    .map((finding) => `${String(finding.line)}:${String(finding.column)} ${String(finding.values["word"])}`);

describe("doubled-word — 括弧の注を挟んだ同じ助詞", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("invalid: 注の前と後ろに同じ助詞", () => {
    assert.deepEqual(findingsOf("本会則は(以下、会則)は会員の決まりを定めます。"), ["1:12 はは"]);
    assert.deepEqual(findingsOf("貸主が（以下「甲」という。）が建物を貸します。"), ["1:15 がが"]);
    assert.deepEqual(findingsOf("会員規程を （以下、規程） を守ってください。"), ["1:15 をを"]);
  });

  it("invalid: 契約の文書でも出す（doubled-word は契約でも動く）", () =>
    assert.deepEqual(findingsOf("本会則は(以下、会則)は会員の決まりを定めます。", "legal/contract"), ["1:12 はは"]));

  it("valid: 注の前と後ろで助詞が違う", () => {
    assert.deepEqual(findingsOf("本会則は(以下、会則)を会員に配ります。"), []);
    assert.deepEqual(findingsOf("本会則(以下、会則)は会員の決まりを定めます。"), []);
    assert.deepEqual(findingsOf("貸主が（甲）に建物を貸します。"), []);
  });

  it("valid: 「AはBは」の対比は、あいだに語がある", () => {
    assert.deepEqual(findingsOf("夏は海は混みます。"), []);
    assert.deepEqual(findingsOf("会員は(正会員に限り)総会では発言できます。"), []);
  });

  it("valid: 括弧の番号を挟んで名前を続ける「の」", () => {
    assert.deepEqual(findingsOf("別表の（1）の欄に書いてください。"), []);
  });

  it("valid: 括弧が閉じない、入れ子の括弧、英語の文", () => {
    assert.deepEqual(findingsOf("本会則は(以下、会則は会員の決まりを定めます。"), []);
    assert.deepEqual(findingsOf("This rule (the rule) the members follow."), []);
    assert.deepEqual(findingsOf("This rule (the rule) the members follow.", "business/report", en, "en"), []);
  });
});
