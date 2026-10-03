import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { rangesIn } from "../packages/chaff/src/detectors/range-notation.ts";
import { formMinority } from "../packages/chaff/src/detectors/form-minority.ts";

// 範囲の記号が混ざっている（range-notation-consistency）。例文はすべて自作。

const RULE = "range-notation-consistency";
const NORMAL_LIMIT = 34;
const MARKS = ["〜", "～", "–", "-"];
const AMBIGUOUS = ["-"];

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const rangesOf = (text: string): string[] => rangesIn(text, MARKS, AMBIGUOUS).map((range) => `${range.written}=${range.form}`);

describe("range-notation-consistency: 範囲の記号が混ざっている", () => {
  it("少ないほうの記号の範囲を指す", () => {
    assert.deepEqual(findingsOf("定員は 10〜20 名、所要は 30〜40 分、費用は 500〜800 円です。対象は 6-12 歳です。\n"), [
      "範囲を「6-12」と書いています（この文書はふつう「10〜20」のように書きます。4 箇所のうち 1 箇所が違う）",
    ]);
    assert.deepEqual(findingsOf("Groups of 10–20 meet for 30–40 minutes, at 5–8 dollars each. Children aged 6-12 are welcome.\n", en), [
      'The range "6-12" here, where the document usually writes ranges like "10–20" (1 of 4)',
    ]);
  });

  it("範囲を読む。空白、小数、全角", () => {
    assert.deepEqual(rangesOf("10 〜 20 名、1.5–2.5 倍、１０～２０人、20-30%"), ["10 〜 20=〜", "1.5–2.5=–", "１０～２０=～", "20-30=-"]);
  });

  it("前後にさらに数の続く並び（日付、電話、時刻）は範囲ではない", () => {
    assert.deepEqual(rangesOf("2026-10-02、03-1234-5678、10:00〜12:00、1.2-3.4.5"), []);
  });

  it("終わりが始まりより小さいもの（郵便番号、試合）は範囲ではない", () => {
    assert.deepEqual(rangesOf("〒100-0001 で 3-2 の勝ち。20〜10"), []);
  });

  it("ハイフンは後ろに単位や語が続くときだけ。行の頭の節の番号と、括弧の後ろの電話番号は読まない", () => {
    assert.deepEqual(rangesOf("2-3（定義）参照、NSF 13-542)。"), []);
    assert.deepEqual(rangesOf("- 1-2 適用対象\n## 2-3 定義\n電話 (703) 292-7827 or mail"), []);
    assert.deepEqual(rangesOf("2〜3（定義）"), ["2〜3=〜"]);
    assert.deepEqual(
      rangesIn("図2-1に示す。See Section 1-2 below and NSF 13-542 now; aged 6-12 years", MARKS, AMBIGUOUS, ["図", "Section"]).map((range) => range.written),
      ["6-12"],
    );
  });

  it("少ないほうが三分の一を超えるか、同じ数なら使い分けと読む", () => {
    assert.equal(formMinority(rangesIn("10〜20人、30〜40人、5-8人、6-9人、1〜2人", MARKS, AMBIGUOUS), NORMAL_LIMIT), undefined);
    assert.equal(formMinority(rangesIn("10〜20人、5-8人", MARKS, AMBIGUOUS), NORMAL_LIMIT), undefined);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("定員は 10〜20 名、30〜40 分、500〜800 円です。`6-12 歳` は例です。\n"), []);
  });

  it("空の文字列と記号の無い言語", () => {
    assert.deepEqual(rangesIn("", MARKS), []);
    assert.deepEqual(rangesIn("10〜20 名", []), []);
  });
});
