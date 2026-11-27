import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 貯蓄・融資・講習で閉じる名前は、制度や法令が名付けたもので、置き方を問わず名前。例文は自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "business/report"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("max-kanji-continuous: 貯蓄・融資・講習で閉じる名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 貯蓄・融資・講習で閉じる名前は、文の中で一度だけ使っても数えない", () => {
    assert.deepEqual(kanjiWords("持家の取得を促すため、勤労者財産形成住宅貯蓄の普及を図り、勤労者財産形成持家融資を行う。\n"), []);
    assert.deepEqual(kanjiWords("登録講習機関が実施する既存住宅状況調査技術者講習で技術者を育てる。\n"), []);
  });

  it("invalid: 閉じる語の無い連なりと、閉じる語の後ろに語が続く連なりは数える", () => {
    assert.deepEqual(kanjiWords("来週、新規顧客獲得施策検討会議を開きます。\n"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("既存住宅状況調査技術者講習受講者名簿を配る。\n"), ["既存住宅状況調査技術者講習受講者名簿"]);
  });
});
