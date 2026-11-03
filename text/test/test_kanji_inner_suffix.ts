import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 連なりの中ほどの「等」は語の終わりを見せるので、その前後を別に数える。例文は自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "docs"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("max-kanji-continuous: 連なりの中ほどの「等」", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 「等」の前と後ろがそれぞれ上限までなら数えない", () => {
    assert.deepEqual(kanjiWords("高齢運転者等専用駐車区間の整備を進めた。\n"), []);
    assert.deepEqual(kanjiWords("公的給付等口座登録簿に記録した。\n"), []);
    assert.deepEqual(kanjiWords("税金等調整前当期純利益が増えた。\n"), []);
  });

  it("invalid: 「等」の前か後ろが上限を超えれば、その側を数える", () => {
    assert.deepEqual(kanjiWords("施設等新規顧客獲得施策検討会議を開いた。\n"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("新規顧客獲得施策検討会議等資料を配った。\n"), ["新規顧客獲得施策検討会議"]);
  });

  it("invalid: 「等」の無い連なりと、「等」を含む別の語（等級）は割らない", () => {
    assert.deepEqual(kanjiWords("新規顧客獲得施策検討会議を開いた。\n"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("高齢運転者等級専用駐車区間を設けた。\n"), ["高齢運転者等級専用駐車区間"]);
  });
});
