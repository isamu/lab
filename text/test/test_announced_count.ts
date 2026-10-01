import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 予告した数と箇条書きの数が合わない（announced-count-mismatch）。箇条書きのすぐ前の文の「以下の3点」を、項目の数と比べる。

const RULE = "announced-count-mismatch";

const found = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["phrase"])}/${String(finding.values["listed"])}`);

const doc = (lead: string, ...items: string[]): string => ["# Notice", "", lead, "", ...items, ""].join("\n");

describe("announced-count-mismatch", () => {
  it("a Japanese announcement with a counter, and a list with one item fewer or more", () => {
    assert.deepEqual(found(doc("申し込みの前に、次の3点を確認してください。", "- 書類", "- 口座"), ja), ["3点/2"]);
    assert.deepEqual(found(doc("以下の2つの理由で延期します。", "- 天候", "- 人手", "- 予算"), ja), ["2つ/3"]);
    assert.deepEqual(found(doc("申し込みの前に、次の3点を確認してください。", "- 書類", "- 口座", "- 印鑑"), ja), []);
  });

  it("kanji numerals and full-width digits are counts too", () => {
    assert.deepEqual(found(doc("改善点は次の三つです。", "- 速さ", "- 費用"), ja), ["三つ/2"]);
    assert.deepEqual(found(doc("次の４項目を記入してください。", "1. 氏名", "2. 住所", "3. 電話"), ja), ["４項目/3"]);
  });

  it("an English announcement with a word pointing ahead, or a colon at its end", () => {
    assert.deepEqual(found(doc("Check the following three items.", "- ID", "- Bank account")), ["three items/2"]);
    assert.deepEqual(found(doc("There are two reasons:", "- Weather", "- Staff", "- Budget")), ["two reasons/3"]);
    assert.deepEqual(found(doc("We took three key steps:", "1. Plan", "2. Build")), ["three key steps/2"]);
    assert.deepEqual(found(doc("Keep the following two in mind:", "- Speed")), []);
    assert.deepEqual(found(doc("Pay only the following two:", "- Speed")), ["two/1"]);
    assert.deepEqual(found(doc("The following expenses need no receipt when each is under $75:", "- Taxi", "- Wifi")), []);
    assert.deepEqual(found(doc("Check the following three items:", "- ID", "- Bank account", "- Address")), []);
  });

  it("the items at the top level are counted; nested items and wrapped lines are not", () => {
    const nested = doc("次の2点を守ってください。", "- 期限", "  - 10月5日まで", "  - 遅れたら連絡", "- 書式", "  PDFで出すこと");
    assert.deepEqual(found(nested, ja), []);
  });

  it("an announcement inside a list item counts the list nested under it", () => {
    const source = ["# Notice", "", "- Plan", "- Check the following two items:", "  - ID", "  - Account", "  - Address", ""].join("\n");
    assert.deepEqual(found(source), ["two items/3"]);
  });

  it("the item above the parent item is not part of the announcement", () => {
    const source = ["# 決定事項", "", "- 次の2点を決めた", "- 以下の3点を確認する：", "  - 日程", "  - 場所", ""].join("\n");
    assert.deepEqual(found(source, ja), ["3点/2"]);
  });

  it("a number with no word pointing ahead and no colon is not an announcement", () => {
    assert.deepEqual(found(doc("先月は3件の障害があった。", "- 手順を見直す"), ja), []);
    assert.deepEqual(found(doc("We had three incidents last month.", "- Review the runbook")), []);
  });

  it("an estimate, a rank, a range or a number to pick is not the count of the list", () => {
    assert.deepEqual(found(doc("次の3つ以上に当てはまれば対象です。", "- A", "- B", "- C", "- D"), ja), []);
    assert.deepEqual(found(doc("以下から1つ選んでください。", "- A", "- B", "- C"), ja), []);
    assert.deepEqual(found(doc("以下の2〜3点を確認します。", "- A", "- B"), ja), []);
    assert.deepEqual(found(doc("Choose two of the following options:", "- A", "- B", "- C")), []);
    assert.deepEqual(found(doc("The first three steps are:", "- A", "- B", "- C", "- D")), []);
    assert.deepEqual(found(doc("Pick at least two options below:", "- A", "- B", "- C")), []);
    assert.deepEqual(found(doc("Follow these two to three steps:", "- A", "- B", "- C", "- D")), []);
  });

  it("a sentence with two numbers is not judged", () => {
    assert.deepEqual(found(doc("以下の5項目のうち、2つを満たすこと。", "- A", "- B", "- C"), ja), []);
  });

  it("only the last sentence before the list announces it", () => {
    assert.deepEqual(found(doc("次の3点は前回決めた。今回は残りを決める。", "- A", "- B"), ja), []);
  });

  it("a paragraph or a heading between the announcement and the list stops the check", () => {
    const between = ["# Notice", "", "Check the following three items:", "", "Some context first.", "", "- A", "- B", ""].join("\n");
    assert.deepEqual(found(between), []);
    const heading = ["# Notice", "", "## The following three items:", "", "- A", "- B", ""].join("\n");
    assert.deepEqual(found(heading), []);
  });

  it("a list split in two right after the announcement is not judged", () => {
    const split = ["# Notice", "", "Check the following three items:", "", "- A", "- B", "", "1. C", ""].join("\n");
    assert.deepEqual(found(split), []);
  });

  it("a list right after another list is not judged against an announcement in the other list's last item", () => {
    const split = ["# Notice", "", "- Plan", "- Check the following two items:", "", "1. A", "2. B", "3. C", ""].join("\n");
    assert.deepEqual(found(split), []);
  });

  it("a list inside a quotation is someone else's words", () => {
    const quoted = ["# Notice", "", "> Check the following three items:", ">", "> - A", "> - B", ""].join("\n");
    assert.deepEqual(found(quoted), []);
  });
});
