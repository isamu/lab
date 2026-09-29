import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expansionAt } from "../packages/chaff/src/detectors/acronym-expansion.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 記号を = で定義する書き方（where N = number of injuries, EH = total hours worked）。定義は記号の後ろにある。
// BLS の用語集の EH が報告されていた。例文は自作。

const expanded = expansionAt({ markers: [], verbs: [] });

const definedIn = (text: string, acronym: string): boolean => expanded(text, acronym, text.indexOf(acronym));

describe("= で定義した記号", () => {
  [
    ["空白を挟む", "where EH = total hours worked"],
    ["空白を挟まない", "where EH=total hours worked"],
    ["大文字で始まる定義", "where EH = Employee Hours"],
    ["全角の等号", "EH ＝ 総労働時間"],
  ].forEach(([form, text]) => {
    it(`valid: ${String(form)}`, () => assert.ok(definedIn(String(text), "EH")));
  });

  [
    ["値を入れる（数字）", "where EH = 2,000"],
    ["値を入れる（記号）", "where EH = $2,000 and EH = -1"],
    ["値を入れる（単位付きの数）", "where EH = 40h"],
    ["比べる", "if EH == total"],
    ["矢印", "EH => total"],
    ["等号が記号の前", "total = EH"],
    ["等号の後ろに何も無い", "where EH ="],
    ["等号の後ろが別の略語だけ", "where EH = SRE"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.ok(!definedIn(String(text), "EH")));
  });
});

const reported = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

describe("undefined-acronym と = の定義", () => {
  it("en: 先に使い、後ろで = で定義した記号は数えず、SRE は数える", () => {
    assert.deepEqual(reported(en, "# Notes\n\nThe rate is (N/EH) X 200,000, where N = number of cases and EH = total hours worked. The SRE joins.\n"), ["SRE"]);
  });

  it("en: 値を入れただけの記号は数える", () => {
    assert.deepEqual(reported(en, "# Notes\n\nSet EH = 2,000 before the run.\n"), ["EH"]);
  });

  it("ja: = で定義した記号は数えず、SRE は数える", () => {
    assert.deepEqual(reported(ja, "# 手引き\n\n率は N/EH で求めます（EH＝総労働時間）。SREも見ます。\n"), ["SRE"]);
  });
});
