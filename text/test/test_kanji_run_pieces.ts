import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { standaloneNames, unknownPieces } from "../packages/chaff/src/detectors/kanji-run-pieces.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 読み手が知っている語（組織の名前、文書が単独で使う語、決まった語）は、漢字の連なりの中でも切れ目を見せる。
// 例文は自作か、首相官邸（政府標準利用規約 2.0、PDL-1.0 互換）と気象庁の公開文から短く採った。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "speech/address"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("unknownPieces", () => {
  const known =
    (...pieces: string[]) =>
    (words: readonly string[]) =>
    (start: number, end: number): boolean =>
      pieces.includes(words.slice(start, end).join(""));

  it("知っている語を外した残りの一続きを、頭から順に", () => {
    const words = ["国連", "安全", "保障", "理事", "会", "改革"];
    assert.deepEqual(unknownPieces(words, 8, known("国連安全保障理事会")(words)), [{ text: "改革", first: false }]);
    const middle = ["新規", "安全", "保障", "理事", "会", "改革", "案"];
    assert.deepEqual(unknownPieces(middle, 8, known("安全保障理事会")(middle)), [
      { text: "新規", first: true },
      { text: "改革案", first: false },
    ]);
  });

  it("連なり全体は知っている語と読まない（呼び出し側が先に決める）。知っている語が無ければ一つの残り", () => {
    const words = ["安全", "保障", "理事", "会"];
    assert.deepEqual(unknownPieces(words, 8, known("安全保障理事会")(words)), [{ text: "安全保障理事会", first: true }]);
    assert.deepEqual(
      unknownPieces(["新規", "顧客"], 8, () => false),
      [{ text: "新規顧客", first: true }],
    );
    assert.deepEqual(
      unknownPieces([], 8, () => true),
      [],
    );
  });

  it("知っている語は maxWords 語まで。長い連なりも一度で読む", () => {
    const words = ["安全", "保障", "理事", "会", "改革"];
    assert.deepEqual(unknownPieces(words, 3, known("安全保障理事会")(words)), [{ text: "安全保障理事会改革", first: true }]);
    const long = Array.from({ length: 100_000 }, () => "紀");
    assert.deepEqual(
      unknownPieces(long, 8, () => false),
      [{ text: long.join(""), first: true }],
    );
  });

  it("最も長い知っている語を取る", () => {
    const words = ["日本", "国", "内閣", "総理", "大臣"];
    assert.deepEqual(unknownPieces(words, 8, known("総理大臣", "内閣総理大臣")(words)), [{ text: "日本国", first: true }]);
  });
});

describe("standaloneNames", () => {
  const units = ["理事会", "局"];
  it("組織の語で閉じ、字数が下限から上限までの連なりだけ", () => {
    assert.deepEqual([...standaloneNames(["改革", "安全保障理事会", "長周期地震動階級", "国際連合安全保障理事会"], 6, 8, units)], ["安全保障理事会"]);
    assert.deepEqual([...standaloneNames(["理事会", "事務総長理事会"], 3, 8, units)], ["事務総長理事会"]);
    assert.deepEqual([...standaloneNames([], 6, 8, units)], []);
  });
});

describe("max-kanji-continuous: 知っている語で割る", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 文書が単独で使う組織の名前を含む連なり（安全保障理事会）", () => {
    assert.deepEqual(kanjiWords("安全保障理事会の役割は重い。安全保障理事会常任理事国が隣国を侵略した。\n"), []);
    assert.deepEqual(kanjiWords("安全保障理事会は動かない。安全保障理事会決議により認められた。\n"), []);
    assert.deepEqual(kanjiWords("# 安全保障理事会\n\n安全保障理事会常任理事国が参加した。\n"), []);
  });

  it("valid: 決まった職名と、許可を受けた者の類の名前（内閣総理大臣、許可事業者）", () => {
    assert.deepEqual(kanjiWords("日本国内閣総理大臣、山田太郎であります。\n"), []);
    assert.deepEqual(kanjiWords("地震動予報許可事業者に説明を求めます。\n", "docs/faq"), []);
  });

  it("valid: 用語集の見出し語の行", () => {
    assert.deepEqual(kanjiWords("地域平均気温平年差\n\n地域ごとの気温平年差を平均して算出した値。\n", "docs/glossary"), []);
  });

  it("invalid: 単独で使う名前が無いか、単独で使う語が組織の名前でなければ、割らない", () => {
    assert.deepEqual(kanjiWords("安全保障理事会常任理事国が隣国を侵略した。\n"), ["安全保障理事会常任理事国"]);
    assert.deepEqual(kanjiWords("提供依頼申出書を出す。提供依頼申出書作成説明会を開く。\n", "business/report"), ["提供依頼申出書作成説明会"]);
  });

  it("invalid: 知っている語を外しても長い残り、短い単独の語は割らない", () => {
    assert.deepEqual(kanjiWords("我が国は国連安全保障理事会改革に取り組みます。\n"), ["国連安全保障理事会改革"]);
    assert.deepEqual(kanjiWords("会議の話をした。新規顧客獲得施策検討会議を開く。\n", "business/report"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("情報処理推進機構認定試験を受ける。\n", "business/report"), ["情報処理推進機構認定試験"]);
    assert.deepEqual(kanjiWords("昨年の内閣総理大臣就任以来、取り組んできました。\n"), ["内閣総理大臣就任以来"]);
  });

  it("invalid: 用語集でない文書の一行だけの連なりと、用語集の説明の文の中の連なり", () => {
    assert.deepEqual(kanjiWords("地域平均気温平年差\n\n地域ごとの値。\n", "docs/faq"), ["地域平均気温平年差"]);
    assert.deepEqual(kanjiWords("平年差\n\n地域平均気温平年差を平均した値。\n", "docs/glossary"), ["地域平均気温平年差"]);
  });
});
