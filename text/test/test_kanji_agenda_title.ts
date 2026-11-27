import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 文を閉じる印の無い一行が「について」で終われば議題の題で、その中の連なりは題に付けた名前。例文は自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "business/meeting-notes"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("max-kanji-continuous: 議題の題", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 「について」で終わる一行の議題の中の連なりは数えない", () => {
    assert.deepEqual(
      kanjiWords("## 報告事項\n\n- 青葉市営自転車駐車場指定管理者の選定に関する方針について\n- 旧青葉第三小学校跡地活用検討の進捗について\n"),
      [],
    );
    assert.deepEqual(kanjiWords("## 報告事項\n\n- 令和7年度進行管理対象事業執行報告（上半期）について\n"), []);
    assert.deepEqual(kanjiWords("## 報告事項\n\n- 青葉市営自転車駐車場指定管理者の選定に関する方針について\n資料配付のみ（資料18　土木部）\n"), []);
  });

  it("valid: 一行だけのお知らせの題は、これまでどおり数えない", () => {
    assert.deepEqual(kanjiWords("[青葉]本人確認・追加認証設定解除完了のお知らせ\n"), []);
  });

  it("invalid: 文を閉じる議題の文と、「について」で終わらない行は数える", () => {
    assert.deepEqual(kanjiWords("青葉市営自転車駐車場指定管理者の選定について説明した。\n"), ["青葉市営自転車駐車場指定管理者"]);
    assert.deepEqual(kanjiWords("- 青葉市営自転車駐車場指定管理者の選定\n"), ["青葉市営自転車駐車場指定管理者"]);
    assert.deepEqual(kanjiWords("- 青葉市営自転車駐車場指定管理者についての意見と回答\n"), ["青葉市営自転車駐車場指定管理者"]);
    assert.deepEqual(kanjiWords("会議では青葉市営自転車駐車場指定管理者について\n説明があった。\n"), ["青葉市営自転車駐車場指定管理者"]);
  });
});
