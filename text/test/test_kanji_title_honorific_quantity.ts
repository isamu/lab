import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { trailingQuantity } from "../packages/chaff/src/detectors/counter-edge.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 『』でくくった作品や碑の題の中、皇族の敬称（両殿下）、尻の漢数字の数と助数詞（六十周年）。
// 名前は首相官邸の演説（政府標準利用規約 2.0、PDL-1.0 互換）に出るもの。文は書き起こした。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "speech/address"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

const token = (surface: string, start: number, features: Record<string, string> = {}): Token => ({
  surface,
  span: { start, end: start + surface.length },
  pos: "NOUN",
  features,
});
const CARD = { NumType: "Card" };
const CLASS = { NounType: "Class" };

describe("trailingQuantity", () => {
  it("尻の漢数字の数と助数詞を外す。数の前に語が残るときだけ", () => {
    const tokens = [token("国交", 0), token("正常", 2), token("化", 4), token("六", 5, CARD), token("十", 6, CARD), token("周年", 7, CLASS)];
    assert.deepEqual(trailingQuantity(tokens, { start: 0, end: 9 }, "国交正常化六十周年"), { surface: "六十周年", start: 5 });
  });

  it("連なりがまるごと数、数の無い助数詞、助数詞で終わらない連なり、空は外さない", () => {
    assert.equal(trailingQuantity([token("六", 0, CARD), token("十", 1, CARD), token("周年", 2, CLASS)], { start: 0, end: 4 }, "六十周年"), undefined);
    assert.equal(trailingQuantity([token("創立", 0), token("周年", 2, CLASS)], { start: 0, end: 4 }, "創立周年"), undefined);
    assert.equal(trailingQuantity([token("会議", 0), token("六", 2, CARD), token("会場", 3)], { start: 0, end: 5 }, "会議六会場"), undefined);
    assert.equal(trailingQuantity([], { start: 0, end: 0 }, ""), undefined);
  });
});

describe("max-kanji-continuous: 題の中、敬称、尻の数", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 『』の中の題、両殿下の前の宮号と身位、尻の漢数字の数", () => {
    assert.deepEqual(kanjiWords("爆心地の近くにある『原爆犠牲国民学校教師と子どもの碑』に刻まれた短歌です。"), []);
    assert.deepEqual(kanjiWords("本日、秋篠宮皇嗣同妃両殿下の御臨席の下、閉会式が開催されます。"), []);
    assert.deepEqual(kanjiWords("来年に国交正常化六十周年を迎えることも見据えます。"), []);
  });

  it("invalid: 「」の中の『』（引用の中の引用）、敬称の前の長い連なり、数の前の長い連なり、『』の外の連なり", () => {
    assert.deepEqual(kanjiWords("彼は「『原爆犠牲国民学校教師と子ども』と言った」と語った。"), ["原爆犠牲国民学校教師"]);
    assert.deepEqual(kanjiWords("本日、新規顧客獲得施策検討会議両殿下の御臨席の下で開きます。"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("来年に新規顧客獲得施策検討会議六十周年を迎えます。"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("『碑』の前の新規顧客獲得施策検討会議を開きます。"), ["新規顧客獲得施策検討会議"]);
  });
});
