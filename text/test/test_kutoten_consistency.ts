import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 句読点の書き方の混在（kutoten-consistency）。例文はすべて自作。

const RULE = "kutoten-consistency";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja).findings;

// 読点を「、」、句点を「。」で書いた段落。
const PLAIN = "申込書は、窓口で受け付けます。書類は、担当者が確認します。結果は、翌日に知らせます。\n\n";

describe("kutoten-consistency: 句読点の書き方がそろっていない", () => {
  it("「、」の文書の中の「，」", () => {
    assert.deepEqual(findingsOf(`${PLAIN}質問は，総務課へ送ってください。\n`), [
      "読点を「，」と書いています（この文書はふつう「、」。4 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("「．」の文書の中の「。」（少ないほうを指摘する。どちらが正しいかは決めない）", () => {
    assert.deepEqual(findingsOf("申込書は，窓口で受け付けます．書類は，担当者が確認します．結果は，翌日に知らせます。\n"), [
      "句点を「。」と書いています（この文書はふつう「．」。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("同数なら、先に使った書き方が文書の書き方", () => {
    assert.deepEqual(findingsOf("申込書は、窓口で受け付けます。書類は，担当者が確認します。\n"), [
      "読点を「，」と書いています（この文書はふつう「、」。2 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("そろっていれば何も言わない", () => {
    assert.deepEqual(findingsOf(PLAIN), []);
    assert.deepEqual(findingsOf("申込書は，窓口で受け付けます．\n"), []);
  });

  it("数の中、番号の後ろ、英字の後ろの「，」「．」は句読点ではない", () => {
    assert.deepEqual(findingsOf(`${PLAIN}料金は１，０００円で、３．５時間です。\n\n１．はじめに、Ｑ．と No．を見ます。手順は、１．確認、２．送付です。\n`), []);
  });

  it("文の中の数や略語の後ろの「，」「．」は句読点（締切は10．、API，）", () => {
    assert.deepEqual(findingsOf(`${PLAIN}締切は10．API，サーバーを再起動します。\n`), [
      "読点を「，」と書いています（この文書はふつう「、」。4 箇所のうち 1 箇所が違う）",
      "句点を「．」と書いています（この文書はふつう「。」。5 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("語の後ろの「．」は文の終わり（API．）", () => {
    assert.deepEqual(findingsOf(`${PLAIN}API．次に進みます。\n`), ["句点を「．」と書いています（この文書はふつう「。」。5 箇所のうち 1 箇所が違う）"]);
  });

  it("鉤括弧で引いたものの中は、引いた元の書き方", () => {
    assert.deepEqual(findingsOf(`${PLAIN}論文には「方法は，次のとおり」とあります。\n`), []);
  });

  it("注の番号で始まる行と、URL を含む文は、文献の書き方", () => {
    assert.deepEqual(findingsOf(`${PLAIN}2\u3000山田太郎，「報告書」，2024年\n\n資料，https://example.jp/ を見ました。\n`), []);
  });

  it("relaxed は 3 箇所から", () => {
    const source = `${PLAIN}質問は，総務課へ。回答は，翌日です。\n`;
    assert.equal(namedRuleRun(RULE, source, ja, "a.md").findings.length, 2);
    const relaxed = namedRuleRun(RULE, source, ja, "a.md", "business/report", "relaxed");
    assert.deepEqual(relaxed.findings, []);
  });

  it("英語の文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "A plain sentence.\n", en).skipped, ["not a rule for en"]);
  });
});
