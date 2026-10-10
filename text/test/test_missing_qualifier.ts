import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { yearGaps, type DatePoint } from "../packages/chaff/src/detectors/date-year.ts";
import { labelLine, measuredValues, unitGaps, unitOf } from "../packages/chaff/src/detectors/number-unit.ts";

// 年の無い日付（date-without-year）と、単位の無い数（number-without-unit）。例文はすべて自作。

const at = (value: string, offset = 0): DatePoint => ({ offset, end: offset + 1, value });
const kinds = (points: readonly DatePoint[]): string[] => yearGaps(points).map((gap) => `${gap.point.value}:${gap.kind}`);

describe("date-without-year: 年の無い日付", () => {
  it("年のある日付が二つ以上の年にわたる文書の、年の無い日付を言う", () => {
    assert.deepEqual(kinds([at("2025-10-15"), at("2026-10-21"), at("10-28")]), ["10-28:years"]);
    assert.deepEqual(
      yearGaps([at("2024-03-01"), at("2026-10-21"), at("2025-01-10"), at("10-28")]).map((gap) => gap.span),
      [{ from: 2024, to: 2026 }],
    );
  });

  it("年のある日付がみな同じ年なら、年の無い日付は言わない", () => {
    assert.deepEqual(kinds([at("2026-10-14"), at("2026-10-21"), at("10-28")]), []);
    assert.deepEqual(kinds([at("2026-01-14"), at("2026-06-21"), at("2026-11-30"), at("04-28")]), []);
  });

  it("年のある日付が一つも無ければ言わない", () => {
    assert.deepEqual(kinds([]), []);
    assert.deepEqual(kinds([at("10-16"), at("12-10"), at("01-15")]), []);
  });

  it("年を一度だけ書く文書（年の無い日付のほうが多い）は言わない", () => {
    assert.deepEqual(kinds([at("2026-10-14"), at("10-16"), at("10-21")]), []);
    assert.deepEqual(kinds([at("2025-10-14"), at("2026-10-21"), at("10-16"), at("10-28")]), []);
    assert.deepEqual(kinds([at("10-16"), at("10-21")]), []);
  });

  it("年のある日付が一つだけなら、少ない側とは言わない", () => {
    assert.deepEqual(kinds([at("2026-10-14")]), []);
    assert.deepEqual(kinds([at("2026-10-14"), at("10-21")]), []);
  });

  it("年の変わり目をまたぐ、年の無い日付は言う", () => {
    assert.deepEqual(kinds([at("2026-12-01"), at("12-10"), at("01-15")]), ["01-15:boundary"]);
    assert.deepEqual(kinds([at("2027-01-20"), at("01-25"), at("11-30")]), ["11-30:boundary"]);
    assert.deepEqual(kinds([at("2026-02-01"), at("02-10"), at("01-15")]), []);
  });

  it("同じ行の前に年のある日付があるか、年を語で言っていれば、年は書いてあると読む", () => {
    const line = "2026年9月25日から10月7日まで。";
    const points = [at("2026-09-25", 0), at("10-07", line.indexOf("10月")), at("2025-10-14", 100), at("2026-10-21", 120)];
    assert.deepEqual(
      yearGaps(points, "\n".repeat(200)).map((gap) => gap.point.value),
      ["10-07"],
    );
    assert.deepEqual(yearGaps(points, `${line}${" ".repeat(200)}`), []);
    const sameYear = "\n同年12月28日まで";
    const later = [at("2025-10-31", 0), at("2026-11-30", 0), at("12-28", sameYear.indexOf("12"))];
    assert.equal(yearGaps(later, sameYear, [{ word: "同年" }]).length, 0);
    assert.equal(yearGaps(later, sameYear, []).length, 1);
    const eachYear = "\nその年の1月1日から12月31日まで";
    const span = [at("2025-10-31", 0), at("2026-11-30", 0), at("01-01", eachYear.indexOf("1月")), at("12-31", eachYear.indexOf("12月"))];
    assert.equal(yearGaps(span, eachYear, [{ word: "その年" }]).length, 0);
  });

  it("年の変わり目をまたぐのは、すぐ前の日付が向こう側の月にあるときだけ", () => {
    assert.deepEqual(kinds([at("2024-12-21"), at("10-01"), at("02-15")]), []);
    assert.deepEqual(kinds([at("2024-12-21"), at("12-10"), at("02-15")]), ["02-15:boundary"]);
    assert.deepEqual(kinds([at("2024-12-21"), at("10-01"), at("10-05"), at("02-15")]), []);
    assert.deepEqual(kinds([at("01-15")]), []);
  });

  it("後ろに立つ年の語と、少し離れて前に立つ年の語も読む", () => {
    const after = "\nby April 15 each year";
    const dated = [at("2025-10-31", 0), at("2026-11-30", 0)];
    const point = at("04-15", after.indexOf("April"));
    const tail = { ...point, end: point.offset + "April 15".length };
    assert.equal(yearGaps([...dated, tail], after, [{ word: "each year", position: "after" }]).length, 0);
    assert.equal(yearGaps([...dated, tail], after, [{ word: "each year", position: "before" }]).length, 1);
    const before = "\nannually, by October 30";
    const late = at("10-30", before.indexOf("October"));
    assert.equal(yearGaps([...dated, late], before, [{ word: "annually", position: "before" }]).length, 0);
    assert.equal(yearGaps([...dated, late], before, [{ word: "annually" }]).length, 1);
    const far = "\nannually, as the rules say, by October 30";
    assert.equal(yearGaps([...dated, at("10-30", far.indexOf("October"))], far, [{ word: "annually", position: "before" }]).length, 1);
  });

  it("月だけ・年だけの日付は数えない", () => {
    assert.deepEqual(kinds([at("2026-10"), at("2026"), at("10-28")]), []);
  });

  it("規則として、日本語の文で言う", () => {
    const source = "# 日程\n\n- 2025年10月15日（水）：前回の説明会\n- 2026年10月21日（水）：締め切り\n- 10月28日（水）：結果の連絡\n";
    assert.deepEqual(namedRuleRun("date-without-year", source, ja).findings, [
      "「10月28日」には年がありません。この文書の日付は 2025年から2026年にわたるので、どの年か決まりません",
    ]);
    const oneYear = "# 日程\n\n- 2026年10月14日（水）：説明会\n- 2026年10月21日（水）：締め切り\n- 10月28日（水）：結果の連絡\n";
    assert.deepEqual(namedRuleRun("date-without-year", oneYear, ja).findings, []);
    const boundary = "# 日程\n\n2026年12月1日に始めます。\n\n12月10日に中間の報告をします。\n\n1月15日に終えます。\n";
    assert.deepEqual(namedRuleRun("date-without-year", boundary, ja).findings, [
      "「1月15日」には年がありません。年の変わり目をまたぐ日付が並んでいるので、どちらの年か決まりません",
    ]);
  });

  it("英語の文書でも言う", () => {
    const source = "# Schedule\n\n- October 15, 2025: last briefing\n- October 21, 2026: applications close\n- October 28: results sent\n";
    assert.deepEqual(namedRuleRun("date-without-year", source, en).findings, [
      '"October 28" has no year, and the document\'s dates run from 2025 to 2026, so the year is unclear',
    ]);
    const oneYear = "# Schedule\n\n- October 14, 2026: briefing\n- October 21, 2026: applications close\n- October 28: results sent\n";
    assert.deepEqual(namedRuleRun("date-without-year", oneYear, en).findings, []);
    const boundary = "# Plan\n\nWe start on December 1, 2026.\n\nThe midpoint report is due December 10.\n\nWe finish on January 15.\n";
    assert.deepEqual(namedRuleRun("date-without-year", boundary, en).findings, ['"January 15" has no year, and the dates around it cross the turn of a year']);
  });

  it("年のある日付が表にだけあっても、本文の年の無い日付と合わせて読む", () => {
    const table = (first: string, second: string): string =>
      `# 日程\n\n| 日付 | 内容 |\n| --- | --- |\n| ${first}年10月15日 | 説明会 |\n| ${second}年10月21日 | 締め切り |\n\n結果は10月28日に知らせます。\n`;
    assert.deepEqual(namedRuleRun("date-without-year", table("2026", "2026"), ja).findings, []);
    assert.deepEqual(namedRuleRun("date-without-year", table("2025", "2026"), ja).findings, [
      "「10月28日」には年がありません。この文書の日付は 2025年から2026年にわたるので、どの年か決まりません",
    ]);
    const prose = (first: string): string =>
      `# Plan\n\nThe briefing was on October 15, ${first} and applications closed on October 21, 2026.\n\n| Date | Item |\n| --- | --- |\n| October 28 | results |\n`;
    assert.deepEqual(namedRuleRun("date-without-year", prose("2026"), en).findings, []);
    assert.deepEqual(namedRuleRun("date-without-year", prose("2025"), en).findings, [
      '"October 28" has no year, and the document\'s dates run from 2025 to 2026, so the year is unclear',
    ]);
  });

  it("年のある日付がみな同じ年でも、年の変わり目をまたぐ日付は言う", () => {
    const source =
      "# Plan\n\nWe start on December 1, 2026, and the review is on December 3, 2026.\n\nThe report is due December 10.\n\nWe finish on January 15.\n";
    assert.deepEqual(namedRuleRun("date-without-year", source, en).findings, ['"January 15" has no year, and the dates around it cross the turn of a year']);
  });

  it("英語で、年を一度だけ書く書き方と、毎年の日付と、範囲の終わりの年は言わない", () => {
    const style = "# Schedule\n\nThe course opens on October 14, 2026.\n\nThe second class is on October 21 and the third on October 28.\n";
    assert.deepEqual(namedRuleRun("date-without-year", style, en).findings, []);
    const yearly =
      "# Reports\n\nThe 2025 report was filed on October 30, 2025, and the 2024 one on October 29, 2024.\n\nReports are due by October 30 each year.\n";
    assert.deepEqual(namedRuleRun("date-without-year", yearly, en).findings, []);
    const range = "# Dates\n\nOpened on May 1, 2026 and closed on May 9, 2026.\n\nThe fair runs June 5 – 7, 2026.\n";
    assert.deepEqual(namedRuleRun("date-without-year", range, en).findings, []);
  });
});

const UNITS = new Set(["円", "分", "時間", "個", "kg", "cm", "$", "min", "USD"]);

const gapsOf = (source: string): string[] => unitGaps(measuredValues(source, source, UNITS)).map((gap) => `${gap.value.name}:${gap.value.written}:${gap.unit}`);

describe("number-without-unit: 単位の無い数", () => {
  it("表の列で、ほかの値に付いた単位が無い数を言う", () => {
    const source = "| 品目 | 金額 |\n| --- | --- |\n| 設計 | 300,000円 |\n| 開発 | 1,200,000 |\n| 試験 | 250,000円 |\n";
    assert.deepEqual(gapsOf(source), ["金額:1,200,000:円"]);
    const gap = unitGaps(measuredValues(source, source, UNITS))[0];
    assert.equal(source.slice(gap?.value.offset ?? 0).split(" ")[0], "1,200,000");
  });

  it("見出しの語の行で、同じ語のほかの値に付いた単位が無い数を言う", () => {
    assert.deepEqual(gapsOf("- Train: $600\n- Hotel: $960\n- Train: 120\n- Train: $80\n"), ["Train:120:$"]);
    assert.deepEqual(gapsOf("所要時間：30分\n\n所要時間：45\n\n所要時間：20分\n"), ["所要時間:45:分"]);
  });

  it("単位の付いた値が一つだけ、単位が混ざる、単位の無い値のほうが多いときは言わない", () => {
    assert.deepEqual(gapsOf("- 予算：300万円\n- 予算：200\n"), []);
    assert.deepEqual(gapsOf("所要時間：30分\n\n所要時間：45\n\n所要時間：2時間\n"), []);
    assert.deepEqual(gapsOf("| 品目 | 数量 |\n| --- | --- |\n| A | 3個 |\n| B | 2 |\n| C | 4 |\n| D | 1個 |\n"), []);
  });

  it("符号の付いた数と全角の数字も値と読む", () => {
    assert.deepEqual(gapsOf("| 項目 | 増減 |\n| --- | --- |\n| A | -3kg |\n| B | -2kg |\n| C | -1 |\n"), ["増減:-1:kg"]);
    assert.deepEqual(gapsOf("幅：３cm\n\n幅：４cm\n\n幅：５\n"), ["幅:５:cm"]);
  });

  it("一つの数でない書き方（版の番号、日付、分数）は値と読まない", () => {
    ["1.2.3", "2026-10-14", "3/4", "$300 USD", "約300円", ""].forEach((text) => assert.equal(unitOf(text, UNITS), undefined, text));
    assert.equal(unitOf("¥300", UNITS), "¥");
    assert.equal(unitOf("300万円", UNITS), "円");
    assert.equal(unitOf("300万", UNITS), "");
    assert.equal(unitOf("3 kg", UNITS), "kg");
  });

  it("見出しの語の行は、リストの印と太字を外して読み、値の位置を指す", () => {
    assert.deepEqual(labelLine("- **予算:** 300円", 10), { label: "予算", value: "300円", at: 20 });
    assert.equal(labelLine("10:30", 0), undefined);
    assert.equal(labelLine("：300円", 0), undefined);
    assert.equal(labelLine("予算：", 0), undefined);
    assert.equal(labelLine("| 予算: 300円 |", 0), undefined);
  });

  it("単位の語彙表に無い語が続く数と、時刻の行は値と読まない", () => {
    assert.deepEqual(gapsOf("| Change | Count |\n| --- | --- |\n| Fixed | 3 fixed |\n| Closed | 2 fixed |\n| Open | 1 |\n"), []);
    assert.deepEqual(gapsOf("10:30\n\n10:20 min\n\n10:40 min\n"), []);
  });

  it("数でない値と、文の中の数は値と読まない", () => {
    assert.deepEqual(gapsOf("| 品目 | 金額 |\n| --- | --- |\n| 設計 | 300,000円 |\n| 開発 | 未定 |\n| 試験 | 250,000円 |\n"), []);
    assert.deepEqual(gapsOf("- 費用：300円\n- 費用：200円\n- 費用：合わせて 100 ほど\n"), []);
  });

  it("規則として、言語ごとの文で言う", () => {
    const source = "# 費用\n\n| 品目 | 金額 |\n| --- | --- |\n| 設計 | 300,000円 |\n| 開発 | 1,200,000 |\n| 試験 | 250,000円 |\n";
    assert.deepEqual(namedRuleRun("number-without-unit", source, ja).findings, [
      "「1,200,000」に単位がありません（「金額」のほかの値には「円」が付いています）",
    ]);
    const english = "# Costs\n\n- Train: $600\n- Train: $960\n- Train: 120\n";
    assert.deepEqual(namedRuleRun("number-without-unit", english, en).findings, ['"120" has no unit (the other "Train" values carry "$")']);
  });

  it("コードの中の表と行は見ない", () => {
    const source = "# 例\n\n```\n- 予算：300円\n- 予算：200円\n- 予算：100\n```\n";
    assert.deepEqual(namedRuleRun("number-without-unit", source, ja).findings, []);
  });
});
