import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 段落の頭に (1)(2)(3) と順に番号を付けた注や文献の一覧は、名前や題を並べた項目で、本文の体言止めに数えない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("taigen-dome-in-prose", source, ja, "a.md", "academic/paper", "strict").findings;

const body = ["# 概要", "", "本稿は図書館の契約の動向を扱う。", "契約の数は年ごとに増えている。", ""].join("\n");

const notes = [
  "(1) 山田太郎. 図書館の契約の歴史. 図書館の研究. 2020.",
  "",
  "(2) 鈴木花子. 電子資料の価格の推移. 情報の科学. 2021.",
  "",
  "(3) 佐藤次郎. 大学の予算の見通し. 大学の経営. 2022.",
  "",
].join("\n");

describe("taigen-dome-in-prose: 番号を付けた注の一覧", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("1 から順に番号を付けた三つ以上の段落は、注の一覧として数えない", () => {
    assert.deepEqual(findingsOf(`${body}\n${notes}`), []);
  });

  it("番号が 1 から始まらない段落、二つだけの段落、番号の無い段落は本文として数える", () => {
    const shifted = notes.replace("(1)", "(4)").replace("(2)", "(5)").replace("(3)", "(6)");
    assert.equal(findingsOf(`${body}\n${shifted}`).length, 1);
    const unlabelled = notes.replaceAll(/\(\d\) /gu, "");
    assert.equal(findingsOf(`${body}\n${unlabelled}`).length, 1);
    const two = notes.split("\n\n(3)")[0] ?? "";
    assert.equal(findingsOf(`${body}\n${two}\n\n今後の課題は予算。\n`).length, 1);
    // 出典の印（URL、西暦の年）の無い (1)(2)(3) は、本文の列挙。
    const enumerated = notes.replaceAll(/ \d{4}\./gu, "");
    assert.equal(findingsOf(`${body}\n${enumerated}`).length, 1);
  });
});
