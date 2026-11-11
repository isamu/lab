import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isFlattenedTableBlock } from "../packages/chaff/src/detectors/sentence-parts.ts";

// repeated-sentence-head と、行の区切りが落ちて一つの段落になった表。例文はすべて自作。

const RULE = "repeated-sentence-head";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", "business/report").findings;

const ROWS = ["アルファ", "ベータ", "ガンマ", "デルタ", "イプシロン", "ゼータ"].map(
  (name, index) =>
    `役員の兼任等…${index % 2 === 0 ? "有り" : "無し"}${name}株式会社東京都港区${String(30 + index)}機械の製造（日本）100.0機械の一部を製造しております。`,
);

describe("repeated-sentence-head: a table whose cells ran together", () => {
  it("rows that each begin with the same cell are a table's rows, not repeated openings", () => {
    assert.deepEqual(findingsOf(`# 関係会社の状況\n\n名称住所資本金主要な事業の内容関係内容${ROWS.join("")}\n`), []);
  });

  it("the same openings in prose are still reported", () => {
    const prose =
      "役員の兼任等について説明します。役員の兼任等は毎年見直します。役員の兼任等は総会で決めます。役員の兼任等の記録は本社に置きます。役員の兼任等の結果は公表します。";
    assert.deepEqual(findingsOf(`# 関係会社の状況\n\n${prose}\n`), ["「役員の兼任等」で始まる文が 5 続いています（3 まで）"]);
  });

  it("isFlattenedTableBlock: decimal cells glued after a bracketed cell, row after row", () => {
    assert.equal(isFlattenedTableBlock(ROWS.join("")), true);
    assert.equal(isFlattenedTableBlock(ROWS.slice(0, 2).join("")), false);
    assert.equal(isFlattenedTableBlock("例として「Really Simple Licensing（RSL）1.0」が挙げられる。"), false);
    assert.equal(isFlattenedTableBlock(""), false);
  });
});
