import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// bracket-width-consistency: a tag in Latin letters opening a line ([Web]登録完了のお知らせ) and an item's address in the prose
// (上記4(2)で) follow the notation of the lines' labels, and a note's number cited in the prose (注(2)) a notation of its own,
// not the prose's brackets. Every example is self-written.

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

  it("compares a note's number cited in the prose (注(2)) only with the other cited note numbers", () => {
    const notes = [...PROSE, "注(2)で示した名簿を見てください。", "", "(1) 名簿は毎年作ります。", "(2) 名簿は総務課にあります。", ""].join("\n");
    assert.deepEqual(findingsOf(notes), []);
    assert.deepEqual(findingsOf(notes.replace("注(2)で", "注（2）で")), []);
  });

  it("compares an item number opening a sentence on a joined line, and the next numbers of its run, with the labels", () => {
    const report =
      "方針を述べます。(1)経営方針当社は（販売事業）に注力します。(2)目標当社は（製造事業）を伸ばします。(3)戦略当社は（物流事業）を強めます。(4)課題当社は（保守事業）を続けます。\n";
    assert.deepEqual(findingsOf(report), []);
    const terms = "概要は次のとおりです。(1)行使期間2025年１月１日から2026年２月28日まで(2)行使価額（当初）から(3)買取価額（時価）（参考）（試算）\n";
    assert.deepEqual(findingsOf(terms), []);
  });

  it("still counts an item number of a joined line when the document writes its item numbers two ways", () => {
    const report =
      "方針を述べます。(1）経営方針当社は（販売事業）に注力します。(2）目標当社は（製造事業）を伸ばします。(3)戦略当社は（物流事業）を強めます。\n";
    assert.notDeepEqual(findingsOf(report), []);
  });

  it("compares an article's clause addresses (第2条(b)(1)および(2)) with the labels", () => {
    const license = [
      "-  第2条(b)(1)および(2)において規定される権利（著作権を含む）は対象（例外を除く）です。",
      "-  第3条(a)(1)(A)(i)に定める者（許諾者）は、第6条(a)の事由（終了）を知らせます。",
      "-  第3条(a)の条件（表示）は、本第6条(b)の定め（回復）に従います。",
      "",
    ].join("\n");
    assert.deepEqual(findingsOf(license), []);
  });

  it("still counts a bracket after a Latin word, a figure's bracket in a table and a Japanese word at a line's head", () => {
    assert.equal(findingsOf([...PROSE, "OSI(Open Source Initiative)の定義を見てください。", ""].join("\n")).length, 1);
    assert.equal(findingsOf([...PROSE, "所有割合は100.0(100.0)プリンター関連です。", ""].join("\n")).length, 1);
    assert.equal(findingsOf([...PROSE, "(背景)会議を開きます。", ""].join("\n")).length, 1);
    assert.equal(findingsOf([...PROSE, "次の(1)及び(2)を送ってください。", ""].join("\n")).length, 2);
    assert.equal(findingsOf([...PROSE, "前回の議題(2)を続けます。", ""].join("\n")).length, 1);
  });
});
