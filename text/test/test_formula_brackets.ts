import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formulaBracketSpans } from "../packages/chaff/src/formula-brackets.ts";

// 式の括弧（賃金 × (1 - 時間 ÷ 月平均)）。例文はすべて自作。

const groupsOf = (text: string): string[] => formulaBracketSpans(text).map((span) => text.slice(span.start, span.end));

describe("formulaBracketSpans: 式をまとめる括弧", () => {
  it("中に × ÷、または前後に空白のある + - = があれば式", () => {
    assert.deepEqual(groupsOf("基本給 × (1 - 欠勤日数 ÷ 所定日数)　+ 手当"), ["(1 - 欠勤日数 ÷ 所定日数)"]);
    assert.deepEqual(groupsOf("時給 × (勤務時間 + 残業時間)"), ["(勤務時間 + 残業時間)"]);
    assert.deepEqual(groupsOf("(売上 = 単価 × 数量)"), ["(売上 = 単価 × 数量)"]);
  });

  it("括弧の外の直前か直後に演算の記号があれば式", () => {
    assert.deepEqual(groupsOf("基本給 × (勤務日数)"), ["(勤務日数)"]);
    assert.deepEqual(groupsOf("(基本給)　+ 手当"), ["(基本給)"]);
    assert.deepEqual(groupsOf("（基本給）÷ 30"), ["（基本給）"]);
  });

  it("全角と半角の括弧も組になり、入れ子はそれぞれ見る", () => {
    assert.deepEqual(groupsOf("賃金 × （1 - (欠勤 ÷ 所定)）"), ["(欠勤 ÷ 所定)", "（1 - (欠勤 ÷ 所定)）"]);
  });

  it("文の中の括弧、記号が空白なしの番号や日付、閉じない括弧は式ではない", () => {
    assert.deepEqual(groupsOf("申し出の撤回(書面による)は受け付ける。"), []);
    assert.deepEqual(groupsOf("規程(A-1)と通知(2026-04-01)を見る。"), []);
    assert.deepEqual(groupsOf("- (注) 対象外"), []);
    assert.deepEqual(groupsOf("料金 * (税込) と手当 (月額) * を見る。"), []);
    assert.deepEqual(groupsOf("賃金 × (1 - 欠勤"), []);
    assert.deepEqual(groupsOf("欠勤 ÷ 所定)"), []);
    assert.deepEqual(groupsOf(""), []);
  });
});
