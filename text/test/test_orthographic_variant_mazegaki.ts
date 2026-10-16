import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 表記ゆれ（orthographic-variant）: 辞書が漢字とかなに切る交ぜ書きの語（証ひょう）。例文はすべて自作。

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string): readonly string[] => namedRuleRun("orthographic-variant", source, ja).findings;

describe("orthographic-variant: 交ぜ書きの語は一語で比べる", () => {
  it("証ひょう の ひょう を、一覧表 の 表 と比べない", () => {
    assert.deepEqual(findingsOf("証ひょうを集めた。証ひょうを確かめた。証ひょうを綴じた。別に一覧表を作った。\n"), []);
  });

  it("はん布 の はん、たん白 の たん を、同じ読みの別の語と比べない", () => {
    assert.deepEqual(findingsOf("冊子をはん布した。はん布の日を決めた。はん布は無料だ。書類に判を押した。\n"), []);
    assert.deepEqual(findingsOf("たん白を取る。たん白の量を量る。たん白が多い。痰が出た。\n"), []);
  });

  it("同じ語を 証憑 と 証ひょう に書き分けていれば言う", () => {
    assert.deepEqual(findingsOf("証憑を集めた。証憑を確かめた。証ひょうを綴じた。\n"), [
      "「証ひょう」と書いています（この文書はふつう「証憑」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
    assert.deepEqual(findingsOf("塡補を行う。塡補の額を決める。てん補の件を話す。\n"), [
      "「てん補」と書いています（この文書はふつう「塡補」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("表 と ひょう のゆれは、交ぜ書きの語があっても言う", () => {
    assert.deepEqual(findingsOf("一覧表を作った。一覧表を配った。一覧ひょうを直した。証ひょうを集めた。\n"), [
      "「ひょう」と書いています（この文書はふつう「表」と書く語です。3 箇所のうち 1 箇所が違う）",
    ]);
  });
});
