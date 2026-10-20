import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// Q&A の印に番号を添えた「A1．」「Q2．」の点は、句点ではない。特許庁の Q&A（chaff-corpus #54、PDL-1.0）の形を短くした自作の文。

const RULE = "kutoten-consistency";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja).findings;

const PLAIN = "申込書は、窓口で受け付けます。書類は、担当者が確認します。結果は、翌日に知らせます。\n\n";

describe("kutoten-consistency: 英字に番号を添えた印の点", () => {
  [
    "### Q1．意思確認の記載はどこに書くか。\n\nA1．申請書の【その他】の欄に記載してください。\n",
    "Ａ１２．全角で書いた印でも同じです。\n",
    "- A3．箇条書きの印の後ろの印も同じです。\n",
  ].forEach((source) => {
    it(`valid: ${source.split("\n").at(-2) ?? source}`, () => assert.deepEqual(findingsOf(`${PLAIN}${source}`), []));
  });

  [
    ["行の終わりの点", "型番は A1．\n"],
    ["語に続く英字と数の後ろの点", "型番はXYZA1．次の型に移ります。\n"],
    ["文の途中の印の形", "結果は A1．次の確認を行います。\n"],
    ["句点の後ろの印の形", "申込書を受けます。A1．次の確認を行います。\n"],
  ].forEach(([form, source]) => {
    it(`invalid: ${String(form)}は句点`, () =>
      assert.deepEqual(
        findingsOf(`${PLAIN}${String(source)}`).map((finding) => finding.slice(0, finding.indexOf("（"))),
        ["句点を「．」と書いています"],
      ));
  });
});
