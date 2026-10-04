import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { strayLettersIn } from "../packages/chaff/src/detectors/ime-residue.ts";

// 変換し損ねた英字（ime-residue）。例文はすべて自作。

const RULE = "ime-residue";
const PARTICLES = ["から", "まで", "が", "を", "は", "に", "の", "と", "で", "も"];

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja).findings;
const lettersOf = (text: string): readonly string[] => strayLettersIn(text, PARTICLES).map((stray) => stray.letter);

describe("ime-residue: 変換し損ねた英字", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("仮名や漢字の後ろ、仮名の前に一字だけ残った英字を指す", () => {
    assert.deepEqual(findingsOf("この資料はとてもおもしrおいです。"), ["日本語の語の中に英字「r」が一字だけあります（変換し損ねた跡）"]);
    assert.deepEqual(lettersOf("申請に対応sたことを報告します。"), ["s"]);
    assert.deepEqual(lettersOf("カタログをおくrります。"), ["r"]);
  });

  it("変数の名、大文字、二字以上の英字、後ろが漢字のもの、片仮名の後ろの記号、パスは指さない", () => {
    assert.deepEqual(lettersOf("変数xが正のとき、まずxを求め、をyで割る。"), []);
    assert.deepEqual(lettersOf("点のx座標とy軸を見る。"), []);
    assert.deepEqual(lettersOf("A社のBさんと、while文とnoteを使う。"), []);
    assert.deepEqual(lettersOf("i18nの設定は gitで行う。"), []);
    assert.deepEqual(lettersOf("サイズmなら在庫があります。プランbです。"), []);
    assert.deepEqual(lettersOf("詳しくは /docs/あaい を参照。"), []);
    assert.deepEqual(lettersOf(""), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("設定は `おもしrおい` のように書きます。"), []);
  });

  it("位置は英字の所", () => {
    assert.deepEqual(
      strayLettersIn("おもしrおい", PARTICLES).map((stray) => stray.offset),
      [3],
    );
  });
});
