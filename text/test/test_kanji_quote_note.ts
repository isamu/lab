import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 鉤括弧の中身が、漢字の連なりと尻の丸括弧の補いだけなら、引いた名前として数えない。例文は自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "business/report"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("max-kanji-continuous: 尻に補いの括弧を添えて引いた名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 「連なり（補い）」で引いた名前は数えない", () => {
    assert.deepEqual(kanjiWords("「臨時職員採用選考書類在中（青葉市総務課）」と朱書きした封筒で送ってください。\n"), []);
    assert.deepEqual(kanjiWords("「臨時職員採用選考書類在中」と朱書きした封筒で送ってください。\n"), []);
  });

  it("invalid: 括弧の中に文や句があるもの、補いの後ろに語が続くもの、括弧の外の連なりは数える", () => {
    assert.deepEqual(kanjiWords("「臨時職員採用選考書類在中を書く（青葉市）」と言われた。\n"), ["臨時職員採用選考書類在中"]);
    assert.deepEqual(kanjiWords("「臨時職員採用選考書類在中（青葉市）用」と書く。\n"), ["臨時職員採用選考書類在中"]);
    assert.deepEqual(kanjiWords("臨時職員採用選考書類在中（青葉市総務課）と朱書きする。\n"), ["臨時職員採用選考書類在中"]);
  });
});
