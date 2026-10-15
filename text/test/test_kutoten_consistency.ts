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
    assert.deepEqual(
      findingsOf(`${PLAIN}料金は１，０００円で、所要は約３．５時間です。\n\n１．はじめに、Ｑ．と No．を見ます。手順は、１．確認、２．送付です。\n`),
      [],
    );
  });

  it("文の中の数や略語の後ろの「，」「．」は句読点（締切は10．、API，）", () => {
    assert.deepEqual(findingsOf(`${PLAIN}締切は10．API，サーバーを再起動します。\n`), [
      "句点を「．」と書いています（この文書はふつう「。」。5 箇所のうち 1 箇所が違う）",
      "読点を「，」と書いています（この文書はふつう「、」。4 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("語の後ろの「．」は文の終わり（API．）", () => {
    assert.deepEqual(findingsOf(`${PLAIN}API．次に進みます。\n`), ["句点を「．」と書いています（この文書はふつう「。」。5 箇所のうち 1 箇所が違う）"]);
  });

  it("片仮名の印、括弧の後ろの番号、続けて書いた注の番号の点は印（イ．、(注)１．、…組合２．）", () => {
    const source = [
      `${PLAIN}（計画の概要）イ．対象期間は３年です。ロ．目標を定めます。窓口の強化ハ．利益を上げます。`,
      "(注)１．特定の子会社はありません。（基本となる事項）１．連結の範囲は次のとおりです。",
      "（注）１．割当先は職員組合２．株式の分割によるものです。３．募集によるものです。\n",
    ].join("");
    assert.deepEqual(findingsOf(source), []);
  });

  it("行の終わりの点と、前に一つ前の番号の無い点は句点（対象はロ．、締切は（予定）10．、書類は３．）", () => {
    assert.deepEqual(findingsOf(`${PLAIN}対象はロ．\n\n締切は（予定）10．\n\n書類は３．次に進みます。\n`), [
      "句点を「．」と書いています（この文書はふつう「。」。7 箇所のうち 3 箇所が違う）",
      "句点を「．」と書いています（この文書はふつう「。」。7 箇所のうち 3 箇所が違う）",
      "句点を「．」と書いています（この文書はふつう「。」。7 箇所のうち 3 箇所が違う）",
    ]);
  });

  it("括弧で添えた語の後ろの数と、１．から並ばない数の点は句点（（予定）10．、10．…11．）", () => {
    assert.deepEqual(findingsOf(`${PLAIN}締切は（予定）10．次回は11．そこまでです。\n`), [
      "句点を「．」と書いています（この文書はふつう「。」。6 箇所のうち 2 箇所が違う）",
      "句点を「．」と書いています（この文書はふつう「。」。6 箇所のうち 2 箇所が違う）",
    ]);
  });

  it("片仮名の語の終わりの点は句点（データ．）", () => {
    assert.deepEqual(findingsOf(`${PLAIN}対象はデータ．次に進みます。\n`), ["句点を「．」と書いています（この文書はふつう「。」。5 箇所のうち 1 箇所が違う）"]);
  });

  it("英字の会社の名前の形の中の「，」「．」は名前の一部（CO.，LTD.、ＣＯ．，ＬＴＤ．）", () => {
    assert.deepEqual(findingsOf(`${PLAIN}子会社 AOBA (THAILAND) CO.，LTD. と ＳＵＮ ＣＯ．，ＬＴＤ．が販売します。\n`), []);
  });

  it("英字の語を並べた「，」は読点（JSON，XML）", () => {
    assert.deepEqual(findingsOf(`${PLAIN}形式はJSON，XMLです。\n`), ["読点を「，」と書いています（この文書はふつう「、」。4 箇所のうち 1 箇所が違う）"]);
  });

  it("鉤括弧で引いたものの中は、引いた元の書き方", () => {
    assert.deepEqual(findingsOf(`${PLAIN}論文には「方法は，次のとおり」とあります。\n`), []);
  });

  it("注の番号で始まる行と、URL を含む文は、文献の書き方", () => {
    assert.deepEqual(
      findingsOf(
        `${PLAIN}2\u3000山田太郎，「報告書」，2024年\n\n[1] 田中花子，「資料」，2024年．\n\n注3 佐藤一郎，「論文」．\n\n資料，https://example.jp/ を見ました。\n`,
      ),
      [],
    );
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
