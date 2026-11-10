import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isRunTogetherList, parallelDotCount } from "../packages/chaff/src/detectors/middle-dot.ts";

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

  it("中黒を含めて 1 語の語（words）の中黒は数えない。語の外の中黒は数える", () => {
    const words = ["キャッシュ・フロー", "ファイナンス・リース"];
    assert.equal(parallelDotCount("営業キャッシュ・フローと投資キャッシュ・フロー", words), 0);
    assert.equal(parallelDotCount("キャッシュ・フロー・利益・売上", words), 2);
    assert.equal(parallelDotCount("キャッシュ・フロー", []), 1);
    assert.equal(parallelDotCount("キャッシュ・ポジション", words), 1);
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

  it("valid: キャッシュ・フローの中黒は並べた項目ではない", () => {
    const statement =
      "営業活動によるキャッシュ・フロー、投資活動によるキャッシュ・フロー、財務活動によるキャッシュ・フロー、フリー・キャッシュ・フロー、ファイナンス・リース債務の返済とキャッシュ・フローの合計を示します。";
    assert.ok(!idsFor(statement).includes("no-nakaguro-parallel"));
  });

  it("invalid: 語彙表の語が混ざっても、並べた中黒が多ければ指摘する", () => {
    assert.ok(idsFor("キャッシュ・フローと企画・開発・運用・保守・営業・販売・広報の体制を見直します。").includes("no-nakaguro-parallel"));
  });

  it("invalid: 地の文で中黒を並べすぎれば、これまでどおり指摘する", () => {
    assert.ok(idsFor("企画・開発・運用・保守、営業・販売・広報・総務の体制を見直します。").includes("no-nakaguro-parallel"));
  });
});

// 一行一項目の箇条書きや年表を、変換が一続きにした文。例文は自作。
describe("no-nakaguro-parallel: 一続きにされた箇条書きと表", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 句の長さの項目を中黒でつないだ文は、箇条書きが行の切れ目を失ったもの", () => {
    const list =
      "今期の重点＜営業＞・地方の小さな店舗への訪問・新しい顧客の名簿の整備・古い契約の条件の見直し・展示会での商品の紹介・取引先との定期的な面談＜管理＞・経費の精算の手順の簡素化";
    assert.ok(isRunTogetherList(list));
    assert.ok(!firedRules(ja, `# 計画\n\n${list}\n`).includes("no-nakaguro-parallel"));
  });

  it("valid: 年の月で行が始まる年表を一続きにした文", () => {
    const rows =
      "沿革1950年４月東京都に会社・工場・倉庫を設立1960年５月大阪・名古屋・福岡に支店を開設1970年６月札幌・仙台・広島に営業所を開設1980年７月本社を移転";
    assert.ok(!firedRules(ja, `# 沿革\n\n${rows}\n`).includes("no-nakaguro-parallel"));
  });

  it("invalid: 短い語の並びは、項目が多くても長さで除かない", () => {
    assert.ok(!isRunTogetherList("企画・開発・運用・保守・営業・販売・広報の体制を見直します。"));
    assert.ok(!isRunTogetherList("水・電力・通信等のライフラインの確保・復旧や、避難者・支援者の生活・活動環境の改善"));
  });
});
