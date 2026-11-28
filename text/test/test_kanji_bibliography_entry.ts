import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isBibliographyEntry } from "../packages/chaff/src/detectors/bibliography-entry.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 注の中の文献の記述（著者. 題. 出版者, 2025.）の漢字の連なりは、引いた文献の題や名前。例文は自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "academic/paper"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("isBibliographyEntry", () => {
  it("著者、題、出版者を句点で区切り、年か題の引用符かリンクかページがある記述", () => {
    assert.equal(isBibliographyEntry("(5) 青葉研究機構. 地域資料保存推進事業における運用方針. 2016."), true);
    assert.equal(isBibliographyEntry("青葉市. “青葉市長定例記者会見録（令和元年5月1日）”. 2019-05-01."), true);
    assert.equal(isBibliographyEntry("(11)山田花子. “資料の公開”．「目録」の展望. 鈴木一郎, 佐藤次郎責任編集. 青葉社, 2025, p. 369."), true);
    assert.equal(isBibliographyEntry("青葉大学図書室. “午後の講座”. 青葉大学学術成果庫.\nhttps://example.org/1, （参照 2019-08-20）."), true);
  });

  it("文の中の句点が二つ無いか、文献の印が無いものは記述ではない", () => {
    assert.equal(isBibliographyEntry("2016年に会議を開いた。"), false);
    assert.equal(isBibliographyEntry("青葉研究機構. 地域資料保存推進事業における運用方針."), false);
    assert.equal(isBibliographyEntry("会議は2016年に開いた．"), false);
    assert.equal(isBibliographyEntry("See Smith. Jones. 2016."), false);
    assert.equal(isBibliographyEntry(""), false);
  });
});

describe("max-kanji-continuous: 文献の記述", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 注の中の文献の記述の題と名前は数えない", () => {
    assert.deepEqual(kanjiWords("(5) 青葉研究機構. 地域資料保存推進事業における運用方針. 2016.\n"), []);
    assert.deepEqual(kanjiWords("(11)山田花子. “資料の公開”．「目録」の展望. 鈴木一郎, 佐藤次郎責任編集. 青葉社, 2025, p. 369.\n"), []);
  });

  it("invalid: 年のある本文の文の連なりは数える", () => {
    assert.deepEqual(kanjiWords("2016年に地域資料保存推進事業検討会議を開いた。\n"), ["地域資料保存推進事業検討会議"]);
  });
});
