import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 方針で閉じる連なりは、題として置かれていれば公表された方針の名前。例文は自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "blog/owned-media"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("max-kanji-continuous: 方針の名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 補いの括弧が続く方針の名前は数えない", () => {
    assert.deepEqual(kanjiWords("出典 : 青葉市豪雨対策基本方針（令和5年12月）を一部編集\n"), []);
  });

  it("invalid: 文の中で一度だけ使った方針の連なりは数える", () => {
    assert.deepEqual(kanjiWords("青葉市豪雨対策基本方針を改めた。\n"), ["青葉市豪雨対策基本方針"]);
  });
});
