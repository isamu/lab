import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { genreFindings, styleConfig } from "../scripts/corpus-findings.ts";

// yarn planted が manifest の style を、chaff.yaml に style: と書いたときと同じに効かせること。

// 句点まで 80 字ほどの一文。koyobun の上限 60 字は超え、ビジネス文書の既定の上限には届かない。
const LONG =
  "粗大ごみの収集は、来月の第一月曜日から、電話又はインターネットによる申込制に変わりますので、収集を希望される方は収集日の前日までに必ず申し込んでください。\n";

const sentenceLengthLines = async (style?: string): Promise<number[]> =>
  (await genreFindings("notice.md", LONG, "ja", "business/report", style))
    .filter((finding) => finding.rule === "max-sentence-length")
    .map((finding) => finding.line);

describe("genreFindings with a style", () => {
  it("style が無ければジャンルの上限で見る", async () => {
    assert.deepEqual(await sentenceLengthLines(), []);
  });

  it("koyobun では一文 60 字の上限で見る", async () => {
    assert.deepEqual(await sentenceLengthLines("koyobun"), [1]);
  });

  it("chaff に無い style は止まる", async () => {
    await assert.rejects(() => sentenceLengthLines("no-such-style"), /no style no-such-style/u);
  });
});

describe("styleConfig", () => {
  it("style の段階を rules に入れ、適用した style を記録する", () => {
    const config = styleConfig("koyobun");
    assert.equal(config.rules["max-sentence-length"], "normal");
    assert.equal(config.applied?.style, "koyobun");
  });

  it("style が無ければ空の設定", () => {
    assert.deepEqual(styleConfig(undefined).rules, {});
    assert.equal(styleConfig(undefined).applied, undefined);
  });
});
