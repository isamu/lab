import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 文書の最後に掲載先が付けた利用条件の断り書きは、本文の文末の調子とも英数字の空け方とも比べない。例文はすべて自作。

const findingsOf = (rule: string, source: string): readonly string[] => namedRuleRun(rule, source, ja, "a.md", "academic/paper").findings;

const body = [
  "# 調査の概要",
  "",
  "本稿は図書館の電子資料の契約を扱う。",
  "契約の数は年ごとに増えている。",
  "多くの大学がOA出版の費用を負担している。",
  "費用の分け方は機関ごとに異なる。",
  "今後の課題は費用の見通しである。",
  "",
].join("\n");

const notice = "本稿は表示 4.0 版 パブリック・ライセンスの下に提供されています。条件は https://example.org/licenses/by/4.0/ でご確認ください。\n";

describe("文書の最後の利用条件の断り書き", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("ライセンスの名前と URL を書いた最後の短い段落は、文末の調子にも空け方にも数えない", () => {
    assert.deepEqual(findingsOf("no-mixed-desumasu", `${body}\n${notice}`), []);
    assert.deepEqual(findingsOf("latin-spacing", `${body}\n${notice}`), []);
  });

  it("リンクで書いた条件の本文も URL と同じに読む", () => {
    const linked = "本稿は[表示 4.0 版 パブリック・ライセンス](https://example.org/licenses/by/4.0/)の下に提供されています。\n";
    assert.deepEqual(findingsOf("latin-spacing", `${body}\n${linked}`), []);
  });

  it("文書の途中に置いた段落、URL の無い段落、ライセンスの語の無い段落、長い最後の段落は本文として数える", () => {
    assert.equal(findingsOf("no-mixed-desumasu", `${notice}\n${body}`).length, 2);
    const unlinked = "本稿は表示 4.0 版 パブリック・ライセンスの下に提供されています。条件は当館の窓口でご確認ください。\n";
    assert.equal(findingsOf("no-mixed-desumasu", `${body}\n${unlinked}`).length, 2);
    const unnamed = "本稿の 4.0 版 の資料は https://example.org/data/ にあります。詳しくは窓口でご確認ください。\n";
    assert.equal(findingsOf("no-mixed-desumasu", `${body}\n${unnamed}`).length, 2);
    const long = [
      "本稿は表示 4.0 版 パブリック・ライセンスの下に提供されています。",
      "資料は図書館で閲覧できる。",
      "複写は窓口で受け付ける。",
      "条件は https://example.org/licenses/by/4.0/ で確かめられる。",
      "",
    ].join("\n");
    assert.equal(findingsOf("no-mixed-desumasu", `${body}\n${long}`).length, 1);
  });
});
