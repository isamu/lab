import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { letterJoinedNameSpans } from "../packages/chaff/src/detectors/letter-joined-name.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 一文字と語を - で繋いだ名前（J-STAGE、X-RAY）の中の大文字は略語ではない。例文は自作。
// J-STAGE の論文ページで、J-STAGE の STAGE が説明の無い略語として報告されていた。

const namesIn = (text: string): string[] => letterJoinedNameSpans(text).map((span) => text.slice(span.start, span.end));

describe("letterJoinedNameSpans", () => {
  [
    ["一文字が前", "published on J-STAGE today", ["J-STAGE"]],
    ["語が小文字混じり", "use T-Mobile or e-Gov", ["T-Mobile", "e-Gov"]],
    ["日本語の文の中", "J-STAGEトップから開きます。", ["J-STAGE"]],
    ["文の終わりの . の前", "see J-STAGE.", ["J-STAGE"]],
  ].forEach(([form, text, names]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(namesIn(String(text)), names));
  });

  [
    ["部品がどちらも二文字以上", "samples go to RT-PCR testing"],
    ["一文字が後ろ（略語の一種）", "under Recommendation ITU-T and the GOODS-S field"],
    ["部品が三つ", "the A-B-C list and J-STAGE-X"],
    ["一文字の部品が二つ", "the A-B test"],
    ["数字を含む", "the J-2 visa, COVID-19 and the J-STAGE2 page"],
    [". で繋いだ名前の一部", "see X.J-STAGE and J-STAGE.X"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(namesIn(String(text)), []));
  });

  it("異常な入力: 空文字、- だけ", () => {
    assert.deepEqual(namesIn(""), []);
    assert.deepEqual(namesIn("- -"), []);
  });
});

describe("undefined-acronym と一文字で繋いだ名前", () => {
  it("ja: J-STAGE の STAGE は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\nJ-STAGEで公開します。SREも見ます。\n"), ["SRE"]);
  });

  it("en: 名前の中で数えなくても、同じ略語が名前の外にあれば数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nThe paper is on J-STAGE now. The STAGE team reviewed it.\n"), ["STAGE"]);
  });

  it("en: 後ろに一文字を繋いだ略語（ITU-T）の略語は数えたまま", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nSee Recommendation ITU-T E.164 on J-STAGE.\n"), ["ITU"]);
  });

  it("en: 二文字以上どうしを繋いだ略語（RT-PCR）は 1 語として数えたまま", () => {
    assert.deepEqual(reportedAcronyms(en, "# Tests\n\nSamples go to RT-PCR testing on J-STAGE.\n"), ["RT-PCR"]);
  });
});
