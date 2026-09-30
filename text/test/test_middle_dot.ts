import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { parallelDotCount } from "../packages/chaff/src/detectors/middle-dot.ts";

// no-nakaguro-parallel: 行頭の「・」は箇条書きの印で、項目を並べる中黒ではない。例文は自作。

const lines = (...rows: string[]): string => rows.join("\n");

describe("parallelDotCount", () => {
  it("文の中の中黒は数える", () => {
    assert.equal(parallelDotCount("企画・開発・運用・保守の体制"), 3);
  });

  it("行頭の「・」は数えない", () => {
    assert.equal(parallelDotCount(lines("・水分を補給すること", "・帽子をかぶること")), 0);
  });

  it("行頭の「・」の後ろの空白と、前の字下げは問わない", () => {
    assert.equal(parallelDotCount(lines("・ 水分を補給すること", "  ・帽子をかぶること", "　・休憩をとること")), 0);
  });

  it("箇条書きの項目の中の中黒は数える", () => {
    assert.equal(parallelDotCount(lines("・ 通気性・透湿性の悪い服装を避けること", "・ 水分・塩分を補給すること")), 2);
  });

  it("行の途中の「・」は、空白の後ろでも数える", () => {
    assert.equal(parallelDotCount("参考 ・資料 ・手引き"), 2);
  });

  it("文頭の「・」は、並べる前の項目が無いので数えない", () => {
    assert.equal(parallelDotCount("・資料を読む"), 0);
  });

  it("中黒の無い文、空の文は 0", () => {
    assert.equal(parallelDotCount("水分を補給する。"), 0);
    assert.equal(parallelDotCount(""), 0);
  });

  it("行頭で続いた「・・」は、印の一つだけを除く", () => {
    assert.equal(parallelDotCount("・・資料"), 1);
  });
});

describe("no-nakaguro-parallel", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const idsFor = (source: string): string[] => firedRules(ja, source);

  const bulletList = lines(
    "次の点に留意すること。",
    "",
    "・ 水分を補給すること",
    "・ 帽子をかぶること",
    "・ 休憩をとること",
    "・ 日陰で過ごすこと",
    "・ 体調を確かめること",
    "・ 無理をしないこと",
  );

  it("valid: 「・」を印にした箇条書きは、何行続いても指摘しない", () => {
    assert.ok(!idsFor(bulletList).includes("no-nakaguro-parallel"));
  });

  it("invalid: 箇条書きの項目の中で中黒を並べすぎれば指摘する", () => {
    const crowded = lines("・ 企画・開発・運用・保守・営業・販売・広報の体制を見直すこと", "・ 無理をしないこと");
    assert.ok(idsFor(crowded).includes("no-nakaguro-parallel"));
  });

  it("invalid: 地の文で中黒を並べすぎれば、これまでどおり指摘する", () => {
    assert.ok(idsFor("企画・開発・運用・保守、営業・販売・広報・総務の体制を見直します。").includes("no-nakaguro-parallel"));
  });
});
