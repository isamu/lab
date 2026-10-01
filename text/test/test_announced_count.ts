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

  // 自作の文。#432 の形：分類した箇条書きと、コロンの手前の別の数。
  it("a categorised list: the count may be the members listed after each label", () => {
    const services = [
      "- **実運用**: CLI / Telegram",
      "- **動作確認済み**: LINE",
      "- **実験的**: Slack / Discord / WhatsApp / Matrix / IRC / Mattermost / Zulip / Messenger / Google Chat",
    ];
    assert.deepEqual(found(doc("つながるサービスが 12 種類に揃いました:", ...services), ja), []);
    assert.deepEqual(
      found(
        doc("We support 12 options:", "- **Stable**: CLI / Telegram", "- **Tested**: LINE", "- **Experimental**: Slack / Discord / A / B / C / D / E / F / G"),
      ),
      [],
    );
    assert.deepEqual(found(doc("We support 11 options:", "- **Stable**: CLI / Telegram", "- **Tested**: LINE", "- **Experimental**: Slack")), ["11 options/3"]);
    assert.deepEqual(found(doc("つながるサービスが 3 種類に揃いました:", ...services), ja), []);
    assert.deepEqual(found(doc("つながるサービスが 11 種類に揃いました:", ...services), ja), ["11 種類/3"]);
  });

  it("a list counted by members only when every item is a label with members", () => {
    assert.deepEqual(found(doc("次の2点を確認してください。", "- **書類**: 住民票 / 印鑑証明", "- 口座", "- 印鑑"), ja), ["2点/3"]);
    assert.deepEqual(found(doc("次の4点を確認してください。", "- 住民票 / 印鑑証明", "- 口座 / 印鑑"), ja), ["4点/2"]);
  });

  it("members are split at slashes only, and not inside inline code", () => {
    const changes = ["- UI: rename the button to `Save, continue`", "- API: add retry handling", "- Docs: fix setup typo"];
    assert.deepEqual(found(doc("The release has 4 changes:", ...changes)), ["4 changes/3"]);
    assert.deepEqual(found(doc("次の4点を変えました:", "- **画面**: ボタンの名前、色", "- **API**: 再試行", "- **文書**: 誤字"), ja), ["4点/3"]);
    assert.deepEqual(found(doc("The release has 4 changes:", "- UI: read `a/b`", "- API: retry", "- Docs: typo")), ["4 changes/3"]);
  });

  it("with only a colon pointing ahead, the colon announces the nearest number", () => {
    const pages = ["- **Calendar**：予定", "- **Actions**：タスク"];
    assert.deepEqual(found(doc("これまで「Scheduler」という 1 つのページにまとめていましたが、独立した 2 ページに分けました:", ...pages), ja), []);
    assert.deepEqual(found(doc("We merged three tasks into 2 pages:", "- Calendar", "- Actions")), []);
    assert.deepEqual(found(doc("We merged three tasks into two pages:", "- Calendar", "- Actions")), []);
  });

  it("a digit inside a version after the phrase is not another number", () => {
    assert.deepEqual(found(doc("We shipped 3 changes in v2:", "- API", "- UI")), ["3 changes/2"]);
  });

  it("a word pointing ahead still names the count, whatever number follows it", () => {
    assert.deepEqual(found(doc("以下の3点を、2週間以内に確認してください:", "- A", "- B"), ja), ["3点/2"]);
    assert.deepEqual(found(doc("Check the following three items within 2 weeks:", "- A", "- B")), ["three items/2"]);
  });

  it("the number nearest the colon is still compared", () => {
    assert.deepEqual(found(doc("改善したのは 3 つの画面です:", "- A", "- B"), ja), ["3 つ/2"]);
  });
});
