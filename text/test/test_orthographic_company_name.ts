import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { japaneseCompanyNameSpans } from "../packages/chaff/src/company-name-run.ts";
import { loadLexicons } from "../packages/lang-ja/src/lexicons.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 会社の名前（青葉硝子㈱）の中の字は書き手が選べないので、表記のゆれ（orthographic-variant）の票にしない。例文はすべて自作。

const FORMS = (loadLexicons()["company-form"] ?? []).map((entry) => entry.pattern);
const namesIn = (text: string): string[] => japaneseCompanyNameSpans(text, FORMS).map((span) => text.slice(span.start, span.end));

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("japaneseCompanyNameSpans", () => {
  [
    ["形の前の名前", "関連会社の青葉硝子㈱を設立", ["青葉硝子㈱"]],
    ["株式会社の前と後ろ", "青葉硝子株式会社での取引と株式会社ADEKAとの取引", ["青葉硝子株式会社", "株式会社ADEKA"]],
    ["(株) の形", "青葉ガラス(株)は", ["青葉ガラス(株)"]],
  ].forEach(([form, text, names]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(namesIn(String(text)), names));
  });

  [
    ["形の無い文", "窓ガラスと硝子戸を作ります"],
    ["会社の語だけ（形ではない）", "関連会社と子会社がガラスを作ります"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(namesIn(String(text)), []));
  });

  it("語彙表が空なら何も無い", () => {
    assert.deepEqual(japaneseCompanyNameSpans("青葉硝子㈱", []), []);
  });
});

describe("orthographic-variant: 会社の名前の中の字", () => {
  const RULE = "orthographic-variant";
  const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja).findings;

  it("会社の名前の 硝子 は、本文の ガラス の票にしない", () => {
    const names = "関連会社の青葉硝子㈱を設立しました。青葉硝子株式会社と取引します。青葉硝子㈱は工場です。";
    assert.deepEqual(findingsOf(`${names}青葉硝子㈱は東京です。青葉硝子㈱は大きい。青葉硝子株式会社では窓ガラスの製造を中心にしています。\n`), []);
  });

  it("本文の 硝子 と ガラス は、名前の外なら数える", () => {
    assert.deepEqual(findingsOf("硝子の器を作ります。硝子の戸を作ります。硝子の棚を作ります。窓ガラスを作ります。\n"), [
      "「ガラス」と書いています（この文書はふつう「硝子」と書く語です。4 箇所のうち 1 箇所が違う）",
    ]);
  });
});
