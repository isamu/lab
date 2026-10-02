import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { misuseMatch } from "../packages/chaff/src/detectors/misuse-match.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";

// 慣用句の誤用（idiom-misuse）。例文はすべて自作。

const RULE = "idiom-misuse";

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", genre).findings;

describe("idiom-misuse: 慣用句の誤用", () => {
  it("誤用の形を、正しい形と一緒に言う", () => {
    assert.deepEqual(findingsOf("課長の指摘は的を得ていました。\n"), ["「的を得る」は誤用とされる形です。「的を射る」と書きます"]);
    assert.deepEqual(findingsOf("次の大会で汚名挽回を狙います。\n"), ["「汚名挽回」は誤用とされる形です。「汚名返上（または名誉挽回）」と書きます"]);
  });

  it("活用した形（すくわれた・振るった）にも当たる", () => {
    assert.deepEqual(findingsOf("油断して足元をすくわれた。\n"), ["「足元をすくわれる」は誤用とされる形です。「足をすくわれる」と書きます"]);
    assert.deepEqual(findingsOf("部長が采配を振るった。\n"), ["「采配を振るう」は誤用とされる形です。「采配を振る」と書きます"]);
    assert.deepEqual(findingsOf("押しも押されぬ大企業です。\n"), ["「押しも押されぬ」は誤用とされる形です。「押しも押されもせぬ」と書きます"]);
  });

  it("正しい形と、似ているだけの文は言わない", () => {
    assert.deepEqual(findingsOf("課長の指摘は的を射ていました。次の大会で汚名返上を狙います。油断して足をすくわれた。\n"), []);
    assert.deepEqual(findingsOf("目的を得るために努力した。名誉挽回の機会です。腕を振るう。\n"), []);
    assert.deepEqual(findingsOf("押しも押されもせぬ大企業です。部長が采配を振った。\n"), []);
  });

  it("一文に一つだけ言う", () => {
    assert.equal(findingsOf("的を得た指摘で汚名挽回した。\n").length, 1);
  });

  it("文学のジャンルでは動かない", () => {
    const source = "課長の指摘は的を得ていました。\n";
    assert.ok(firedRules(ja, source, "business/report").includes(RULE));
    assert.ok(!firedRules(ja, source, "literature/fiction").includes(RULE));
  });

  it("語彙表の形は、どれも文の中で当たる", () => {
    const lexicon = ja.lexicons[RULE] ?? [];
    assert.ok(lexicon.length > 0);
    lexicon.forEach((entry) => assert.equal(findingsOf(`ここで${entry.pattern}。\n`).length, 1, entry.pattern));
  });

  it("語彙表が空なら何も言わない", () => {
    const doc = buildDocument("a.md", "課長の指摘は的を得ていました。\n", ja);
    assert.deepEqual(misuseMatch(doc, { limit: 1, lexicon: [] }), []);
    assert.deepEqual(misuseMatch(doc, { limit: 1 }), []);
  });

  it("limit に届かなければ言わない", () => {
    const doc = buildDocument("a.md", "課長の指摘は的を得ていました。\n", ja);
    assert.deepEqual(misuseMatch(doc, { limit: 2, lexicon: [{ pattern: "的を得", rewrite: "的を射" }] }), []);
    assert.equal(misuseMatch(doc, { limit: 1, lexicon: [{ pattern: "的を得", rewrite: "的を射" }] }).length, 1);
  });
});
