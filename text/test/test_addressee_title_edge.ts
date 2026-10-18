import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { loadLexicons } from "../packages/lang-ja/src/lexicons.ts";
import { endsInOrganisation, trailingTitle, type AddresseeWords } from "../packages/chaff/src/detectors/addressee-title-edge.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// 宛名の並びの「各」と役職は、組織の名前の外にある。漢字の連なりの長さに数えない。官公庁の通知の宛先の形を自作で真似た。

const LEXICONS = loadLexicons();
const patternsOf = (id: string): string[] => (LEXICONS[id] ?? []).map((entry) => entry.pattern);
const WORDS: AddresseeWords = {
  prefixes: patternsOf("addressee-prefix"),
  titles: patternsOf("addressee-title"),
  endings: patternsOf("organisation-unit"),
  forms: (LEXICONS["organisation-form"] ?? []).filter((entry) => entry.position !== "before").map((entry) => entry.pattern),
};

const RULES = loadRules("ja");
/** 通知が読まれる分野。この分野の上限で、宛名の並びを読む。 */
const NOTICE_GENRE = "business/email";

const kanjiWords = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(NOTICE_GENRE), true, NOTICE_GENRE)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values["word"]));

describe("trailingTitle / endsInOrganisation — 組織の名前の後ろの役職", () => {
  it("残りが組織の語か法人格で閉じる、最も長い役職を外す", () => {
    assert.equal(trailingTitle("日本博物館協会会長", WORDS), "会長");
    assert.equal(trailingTitle("都道府県教育委員会教育長", WORDS), "教育長");
    assert.equal(trailingTitle("大学共同利用機関法人機構長", WORDS), "機構長");
    assert.equal(trailingTitle("国公私立高等専門学校長", WORDS), "長");
  });

  it("組織で閉じない語の「長」や、役職だけの連なりは外さない", () => {
    assert.equal(trailingTitle("計画期間延長", WORDS), undefined);
    assert.equal(trailingTitle("経済成長", WORDS), undefined);
    assert.equal(trailingTitle("会長", WORDS), undefined);
    assert.equal(trailingTitle("", WORDS), undefined);
    assert.equal(trailingTitle("本部長", WORDS), undefined);
  });

  it("組織の語の前に 2 字以上の名を要り、法人格はそれだけで閉じる", () => {
    assert.equal(endsInOrganisation("総務課", WORDS), true);
    assert.equal(endsInOrganisation("本部", WORDS), false);
    assert.equal(endsInOrganisation("独立行政法人", WORDS), true);
    assert.equal(endsInOrganisation("", WORDS), false);
  });
});

describe("max-kanji-continuous — 宛名の並び", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("「各」と役職を外した組織の名前は数えない", () => {
    assert.deepEqual(kanjiWords("各国公私立高等専門学校長　殿\n"), []);
    assert.deepEqual(kanjiWords("各大学共同利用機関法人機構長　殿\n"), []);
    assert.deepEqual(kanjiWords("各文部科学省独立行政法人の長　殿\n"), []);
    assert.deepEqual(kanjiWords("公益財団法人日本博物館協会会長　殿\n"), []);
    assert.deepEqual(kanjiWords("独立行政法人国立文化財機構理事長　殿\n"), []);
  });

  it("組織で閉じない長い連なりは、役職の形の語で終わっても指す", () => {
    assert.deepEqual(kanjiWords("情報処理推進機構認定試験期間延長について検討した。\n"), ["情報処理推進機構認定試験期間延長"]);
    assert.deepEqual(kanjiWords("各種情報処理推進機構認定試験を受けた。\n"), ["各種情報処理推進機構認定試験"]);
  });

  it("組織の名前でも、残りが上限を超え名前と読めなければ指す", () => {
    assert.deepEqual(kanjiWords("各市町村行政事務効率化推進委員会委員長　殿\n"), ["市町村行政事務効率化推進委員会"]);
  });

  it("宛名の行でなければ、役職も「各」も連なりのまま数える", () => {
    assert.deepEqual(kanjiWords("各市町村行政事務効率化推進委員会委員長が出席した。\n"), ["各市町村行政事務効率化推進委員会委員長"]);
    assert.deepEqual(kanjiWords("本日、公益財団法人日本博物館協会会長が出席した。\n"), ["公益財団法人日本博物館協会会長"]);
  });
});
