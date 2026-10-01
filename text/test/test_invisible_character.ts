import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { invisibleRuns, visibleQuote } from "../packages/chaff/src/detectors/invisible-character.ts";

// 見えない字（invisible-character）。例文はすべて自作。見えない字は \u で書く。

const RULE = "invisible-character";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const kindsIn = (source: string): string[] => invisibleRuns(source).map((run) => `${run.kind} ${run.codes.join(" ")}`);

describe("invisible-character: 見えない字がある", () => {
  it("ゼロ幅の空白。続いた字は一つにまとめる", () => {
    assert.deepEqual(findingsOf("申込書は\u200B総務課へ送ります。電話は\u200B\u200B\u200B内線です。\n"), [
      "ゼロ幅の字（U+200B）が 1 字あります。検索やコピーで語が切れます",
      "ゼロ幅の字（U+200B）が 3 字あります。検索やコピーで語が切れます",
    ]);
  });

  it("英語の文書は英語で言う", () => {
    assert.deepEqual(findingsOf("Send it to the\u200B office.\n", en), ["1 zero-width character (U+200B): search and copy break the word here"]);
  });

  it("途中の BOM、ソフトハイフン、語の結合子、制御文字", () => {
    assert.deepEqual(kindsIn("a\uFEFFb co\u00ADoperate x\u2060y bell\u0007 tab\tline\nfeed\f"), [
      "zero-width U+FEFF",
      "soft-hyphen U+00AD",
      "zero-width U+2060",
      "control U+0007",
    ]);
  });

  it("右から左に書く文字の無い所の向きの指定は指摘する（読み手に見える順を入れ替えられる）", () => {
    assert.deepEqual(kindsIn("access = \u202Eresu\u202C; 承認\u200Fする"), ["direction U+202E", "direction U+202C", "direction U+200F"]);
  });

  it("右から左に書く文字の隣の向きの印は、並べるためのもの", () => {
    assert.deepEqual(kindsIn("the word שלום\u200E (peace) and مرحبا\u200F!"), []);
  });

  it("右から左の文字を囲む向きの分離（RLI・PDI）は書き方。向きを強制する印（RLO）は隣に右から左の文字があっても指摘する", () => {
    assert.deepEqual(kindsIn("See \u2067שלום\u2069 today."), []);
    assert.deepEqual(kindsIn("name \u202Eשלום"), ["direction U+202E"]);
  });

  it("Codex の指摘: 文書の頭の BOM、括弧を挟んで右から左の文字を囲む分離、閉じない旗のタグ、付く字の無い異体字の指定", () => {
    assert.deepEqual(kindsIn("\uFEFFTitle"), []);
    assert.deepEqual(kindsIn("See \u2067(שלום)\u2069 today."), []);
    assert.deepEqual(kindsIn("Pay \u{1F3F4}\u{E0070}\u{E0077} now"), ["hidden U+E0070 U+E0077"]);
    assert.deepEqual(kindsIn("\uFE0FTitle and note \uFE0F text"), ["hidden U+FE0F", "hidden U+FE0F"]);
  });

  it("アクセント（結合文字）の後ろの ZWJ・ZWNJ は、ラテン文字の後ろと同じに指摘する", () => {
    assert.deepEqual(kindsIn("Cafe\u0301\u200Dmenu e\u0301\u200Cmail"), ["zero-width U+200D", "zero-width U+200C"]);
  });

  it("絵文字の中の ZWJ、アラビア文字やインドの文字の接合子は綴りの一部", () => {
    assert.deepEqual(kindsIn("family 👨\u200D👩\u200D👧 and 👩🏽\u200D💻, क्\u200Dष, می\u200Cخواهم"), []);
  });

  it("ラテン文字や日本語の間の ZWJ・ZWNJ は指摘する", () => {
    assert.deepEqual(kindsIn("ab\u200Dcd 日本\u200C語"), ["zero-width U+200D", "zero-width U+200C"]);
  });

  it("地域の旗のタグ文字は書き方の一部、ふつうの字の後ろのタグ文字は隠れた文", () => {
    const flag = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
    assert.deepEqual(kindsIn(`England ${flag} flag`), []);
    const texas = "\u{1F3F4}\u{E0075}\u{E0073}\u{E0074}\u{E0078}\u{E007F}";
    assert.deepEqual(kindsIn(`Texas ${texas} flag`), []);
    assert.deepEqual(kindsIn("Hello\u{E0069}\u{E0067}\u{E006E} world"), ["hidden U+E0069 U+E0067 U+E006E"]);
  });

  it("字に一つ付いた異体字の指定は書き方、二つ以上続くのは隠れた並び", () => {
    assert.deepEqual(kindsIn("葛\u{E0100}城 ❤\uFE0F 1\uFE0F⃣"), []);
    assert.deepEqual(kindsIn("a\uFE01\uFE02\uFE03b"), ["hidden U+FE01 U+FE02 U+FE03"]);
  });

  it("ノーブレークスペース: 見出しや箇条の印の後ろと日本語の隣は指摘、英文の語の間は数えない", () => {
    assert.deepEqual(kindsIn("##\u00A0Title\n-\u00A0item\n1.\u00A0step\n申込\u00A0書\n"), ["nbsp U+00A0", "nbsp U+00A0", "nbsp U+00A0", "nbsp U+00A0"]);
    assert.deepEqual(kindsIn("Mr.\u00A0Smith paid 10\u00A0km with\u00A0you.\n"), []);
  });

  it("コードの中も数える（コピーしたコマンドが動かなくなる）", () => {
    assert.deepEqual(findingsOf("手順です。\n\n```\nnpm\u200B install\n```\n").length, 1);
  });

  it("引いて見せるときは、見えない字を番号で見せる", () => {
    assert.equal(visibleQuote("申込書は\u200B総務課へ", { start: 4, end: 5 }), "申込書は⟨U+200B⟩総務課へ");
  });

  it("見えない字が無ければ何も言わない", () => {
    assert.deepEqual(findingsOf("申込書は総務課へ送ってください。\n"), []);
    assert.deepEqual(kindsIn(""), []);
  });
});
