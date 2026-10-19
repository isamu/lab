import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { followsForm, holdsName, leadingReference } from "../packages/chaff/src/detectors/kanji-name-edge.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 組織の名前と、括弧でくくった名前と、前を指す語（上記）。例文はすべて自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn("business/report"), true, "business/report", KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

const token = (surface: string, start: number): Token => ({ span: { start, end: start + surface.length }, surface, pos: "NOUN" });

describe("kanji-name-edge", () => {
  it("holdsName: 括弧の中が漢字の連なりと、漢字も平仮名も無い語だけ", () => {
    const text = "「登録業者情報検索入力ページ」を開く。";
    assert.equal(holdsName(text, { start: 1, end: 14 }, 1, 11), true);
    const phrase = "「登録業者情報検索の入力ページ」を開く。";
    assert.equal(holdsName(phrase, { start: 1, end: 15 }, 10, 12), false);
    assert.equal(holdsName(text, { start: 1, end: 14 }, 0, 11), false);
  });

  it("followsForm: 空白を挟んだ法人格の後ろ。空白が無ければ、法人格は連なりの中", () => {
    const forms = ["一般社団法人", "株式会社"];
    assert.equal(followsForm("③一般社団法人 ", forms), true);
    assert.equal(followsForm("③一般社団法人", forms), false);
    assert.equal(followsForm("本日の ", forms), false);
    assert.equal(followsForm("", forms), false);
  });

  it("leadingReference: 解析が分けた頭の語で、後ろに語が残るときだけ", () => {
    const references = ["上記", "当該"];
    assert.equal(leadingReference([token("上記", 5), token("交換業者", 7)], 5, "上記交換業者", references)?.surface, "上記");
    assert.equal(leadingReference([token("上記", 5)], 5, "上記", references), undefined);
    assert.equal(leadingReference([token("上", 5), token("記載", 6)], 5, "上記載", references), undefined);
    assert.equal(leadingReference([], 5, "上記交換業者", references), undefined);
  });
});

describe("max-kanji-continuous: 名前と指す語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 組織の語で閉じる区切りが続く名前（相談所）、空白を挟んだ法人格の後ろの名前（センター）", () => {
    assert.deepEqual(kanjiWords("それでも解決しなければ、青葉保険協会保険相談所に相談してください。\n"), []);
    assert.deepEqual(kanjiWords("③一般社団法人 全国保険個人信用情報センター\n"), []);
  });

  it("valid: 括弧でくくった名前（漢字の連なりとカタカナの語）、前を指す語の後ろの語", () => {
    assert.deepEqual(kanjiWords("確認は、「登録業者情報検索入力ページ」をご利用ください。\n"), []);
    assert.deepEqual(kanjiWords("上記暗号資産交換業者に登録がない場合は届け出ます。\n"), []);
  });

  it("invalid: 法人格が前に無い一つの区切り、平仮名を含む括弧の中、指す語を外しても長い連なりは数える", () => {
    assert.deepEqual(kanjiWords("全国保険個人信用情報センターに問い合わせる。\n"), ["全国保険個人信用情報"]);
    assert.deepEqual(kanjiWords("「登録業者情報検索入力の手引き」を読む。\n"), ["登録業者情報検索入力"]);
    assert.deepEqual(kanjiWords("上記暗号資産交換業者登録簿を見る。\n"), ["暗号資産交換業者登録簿"]);
    assert.deepEqual(kanjiWords("青葉保険協会生命保険契約を結ぶ。\n"), ["青葉保険協会生命保険契約"]);
  });
});
