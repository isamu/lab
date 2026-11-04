import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// bracket-width-consistency: a tag in Latin letters opening a line ([Web]登録完了のお知らせ) and an item's address in the prose
// (上記4(2)で) follow the notation of the lines' labels, not the prose's brackets. Every example is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const RULE = "bracket-width-consistency";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", "docs/manual").findings;

const PROSE = ["会議（定例）は月曜です。", "報告（月次）は金曜です。", "資料（最新版）を配ります。", "名簿（全員分）を配ります。"];

describe("bracket-width-consistency on line labels and item addresses", () => {
  it("compares a Latin tag opening a line only with the other line labels", () => {
    const tags = ["[Web]登録完了のお知らせ", "[Web]変更完了のお知らせ", "[Web]削除完了のお知らせ"];
    assert.deepEqual(findingsOf([...tags, "［保存］を押します。", "［戻る］を押します。", "［次へ］を押します。", ""].join("\n")), []);
  });

  it("compares an item's address with the lines' item numbers", () => {
    const minutes = [...PROSE, "", "(1) 報告書の案", "(2) 報告書の承認", "", "上記4(2)で承認された報告書を提出した。", ""].join("\n");
    assert.deepEqual(findingsOf(minutes), []);
  });

  it("still counts a bracket after a Latin word, a figure's bracket in a table and a Japanese word at a line's head", () => {
    assert.equal(findingsOf([...PROSE, "OSI(Open Source Initiative)の定義を見てください。", ""].join("\n")).length, 1);
    assert.equal(findingsOf([...PROSE, "所有割合は100.0(100.0)プリンター関連です。", ""].join("\n")).length, 1);
    assert.equal(findingsOf([...PROSE, "(背景)会議を開きます。", ""].join("\n")).length, 2);
    assert.equal(findingsOf([...PROSE, "次の(1)及び(2)を送ってください。", ""].join("\n")).length, 4);
  });
});
