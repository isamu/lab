import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { compileFrames, periodLabelsIn } from "../packages/chaff/src/structure/period-labels.ts";
import {
  conflictingStated,
  hasWord,
  periodLabelConflicts,
  refersToCurrent,
  statedPeriodOf,
  type ReportingWords,
} from "../packages/chaff/src/structure/period-label-conflict.ts";

// 題の決算期間と違う期間（period-label-conflict）。題が業績の語と一緒に書いた期間と、今の業績を言う所に書いた同じ種類の別の期間。

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "period-label-conflict": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "period-label-conflict")
    .map((finding) => `${String(finding.values["label"])}/${String(finding.values["stated"])}`);

const foundJa = (...rows: string[]): string[] => findings(rows.join("\n"), ja, "ja");
const foundEn = (...rows: string[]): string[] => findings(rows.join("\n"), en, "en");

const FRAMES = compileFrames([
  { pattern: "第{n}四半期", kind: "quarter" },
  { pattern: "Q{n}", kind: "quarter" },
  { pattern: "second quarter", kind: "quarter", insteadOf: "Q2" },
  { pattern: "{e}年{m}月期", kind: "fiscal-year" },
  { pattern: "{y}年度", kind: "fiscal-year" },
  { pattern: "FY{y}", kind: "fiscal-year" },
  { pattern: "fiscal year ending {_} {e}", kind: "fiscal-year" },
  { pattern: "year ending {_} {e}", kind: "fiscal-year" },
]);

const WORDS: ReportingWords = {
  frames: FRAMES,
  results: ["決算", "業績", "results"],
  periodLines: ["対象期間", "Reporting period"],
  comparisons: ["前年同期", "前期", "prior", "compared with"],
  forecasts: ["予想", "次期", "outlook", "expect"],
  currents: ["当期", "当第", "this quarter"],
  notCurrents: ["当期純利益"],
  notNames: [],
};

const labels = (text: string): string[] => periodLabelsIn(text, FRAMES).map((label) => `${label.kind}:${label.value}`);

describe("period-label-conflict: reading period names", () => {
  it("reads the number, the year and the month a name is written with", () => {
    assert.deepEqual(labels("2027年3月期 第2四半期決算短信"), ["fiscal-year:e2027,m3", "quarter:n2"]);
    assert.deepEqual(labels("Q3 FY2027"), ["quarter:n3", "fiscal-year:y2027"]);
    assert.deepEqual(labels("2026年度"), ["fiscal-year:y2026"]);
    assert.deepEqual(labels("２０２６年３月期"), ["fiscal-year:e2026,m3"]);
  });

  it("a form without a number takes its value from the numbered form in instead_of", () => {
    assert.deepEqual(labels("Second Quarter Results"), ["quarter:n2"]);
  });

  it("a filler slot is not part of the value, and the longer of two overlapping names is kept", () => {
    assert.deepEqual(labels("for the Fiscal Year Ending March 31, 2027"), ["fiscal-year:e2027"]);
  });

  it("does not read a name inside a longer word or number", () => {
    assert.deepEqual(labels("HQ2 and Q23 and FY20265"), []);
    assert.deepEqual(labels("第12四半期"), []);
    assert.deepEqual(labels(""), []);
  });
});

describe("period-label-conflict: the document's period", () => {
  it("is the title's period names when the title has a results word", () => {
    const stated = statedPeriodOf("2027年3月期 第2四半期決算短信", "", WORDS).map((label) => label.written);
    assert.deepEqual(stated, ["2027年3月期", "第2四半期"]);
  });

  it("a title without a results word gives no period", () => {
    assert.deepEqual(statedPeriodOf("2027年3月期 事業計画", "", WORDS), []);
    assert.deepEqual(statedPeriodOf("", "", WORDS), []);
  });

  it("a kind the title does not name comes from the period line", () => {
    const stated = statedPeriodOf("決算短信 FY2026", "Reporting period: Q2", WORDS).map((label) => label.written);
    assert.deepEqual(stated, ["FY2026", "Q2"]);
    const kept = statedPeriodOf("決算 FY2026", "Reporting period: FY2025", WORDS).map((label) => label.written);
    assert.deepEqual(kept, ["FY2026"]);
  });

  it("two different periods of one kind in the title leave that kind unchecked", () => {
    assert.deepEqual(statedPeriodOf("Results for FY2026 and FY2025", "", WORDS), []);
    assert.deepEqual(statedPeriodOf("FY2026 results (FY2026)", "", WORDS).length, 1);
  });

  it("names of one kind but another form are not compared", () => {
    const stated = statedPeriodOf("2027年3月期 決算短信", "", WORDS);
    const [nendo] = periodLabelsIn("2026年度", FRAMES);
    const [other] = periodLabelsIn("2026年3月期", FRAMES);
    assert.ok(nendo !== undefined && other !== undefined);
    assert.equal(conflictingStated(nendo, stated), undefined);
    assert.equal(conflictingStated(other, stated)?.written, "2027年3月期");
  });
});

describe("period-label-conflict: whether a name is about the current results", () => {
  const [q2] = statedPeriodOf("第2四半期決算", "", WORDS);
  const [q1] = periodLabelsIn("第1四半期", FRAMES);
  const [q3] = periodLabelsIn("第3四半期", FRAMES);
  it("an earlier quarter needs a word for the current period", () => {
    assert.ok(q2 !== undefined && q1 !== undefined && q3 !== undefined);
    assert.equal(refersToCurrent(q1, q2, { text: "第1四半期の業績は", headerCell: false }, WORDS), false);
    assert.equal(refersToCurrent(q1, q2, { text: "第1四半期", headerCell: true }, WORDS), false);
    assert.equal(refersToCurrent(q1, q2, { text: "当第1四半期累計", headerCell: true }, WORDS), true);
  });

  it("a later quarter in a table heading cell needs nothing, in a sentence a results or current word", () => {
    assert.ok(q2 !== undefined && q3 !== undefined);
    assert.equal(refersToCurrent(q3, q2, { text: "第3四半期累計", headerCell: true }, WORDS), true);
    assert.equal(refersToCurrent(q3, q2, { text: "第3四半期の業績は", headerCell: false }, WORDS), true);
    assert.equal(refersToCurrent(q3, q2, { text: "第3四半期に新工場が稼働", headerCell: false }, WORDS), false);
  });

  it("a phrase that only holds a current word is not one", () => {
    const [fy2026] = statedPeriodOf("2026年3月期 決算", "", WORDS);
    const [fy2025] = periodLabelsIn("2025年3月期", FRAMES);
    assert.ok(fy2026 !== undefined && fy2025 !== undefined);
    assert.equal(refersToCurrent(fy2025, fy2026, { text: "2025年3月期の当期純利益は50百万円", headerCell: false }, WORDS), false);
    assert.equal(refersToCurrent(fy2025, fy2026, { text: "当期（2025年3月期）の当期純利益は", headerCell: false }, WORDS), true);
  });

  it("words match whole ASCII words only, and any case", () => {
    assert.equal(hasWord("Prior year", ["prior"]), true);
    assert.equal(hasWord("priority", ["prior"]), false);
    assert.equal(hasWord("前年同期比", ["前年同期"]), true);
    assert.equal(hasWord("text", []), false);
  });
});

describe("period-label-conflict: the whole decision on a document", () => {
  const source = ["# 決算短信 FY2026", "", "Reporting period: Q2", "", "Results for FY2025 are below.", ""].join("\n");
  it("reports the sentence after the head, not the head itself", () => {
    const sentence = source.indexOf("Results");
    const found = periodLabelConflicts(
      source,
      [{ start: sentence, end: source.indexOf("below.") + 6 }],
      [{ start: 0, end: 13, text: "決算短信 FY2026" }],
      WORDS,
    );
    assert.deepEqual(
      found.map((issue) => [issue.label, issue.stated]),
      [["FY2025", "FY2026"]],
    );
  });

  it("an empty document has nothing", () => {
    assert.deepEqual(periodLabelConflicts("", [], [], WORDS), []);
  });
});

describe("period-label-conflict: Japanese releases", () => {
  const title = ["# 2027年3月期 第2四半期決算短信〔日本基準〕（連結）", "", "対象期間：2026年4月1日〜2026年9月30日（第2四半期累計）", ""];
  it("reports another quarter in the heading cell of the current results", () => {
    assert.deepEqual(foundJa(...title, "| 項目 | 前年同期 | 当第3四半期累計 |", "| --- | --- | --- |", "| 売上高 | 2,400 | 2,640 |"), ["第3四半期/第2四半期"]);
  });

  it("reports another fiscal year in a sentence about the current period", () => {
    assert.deepEqual(foundJa("# 2026年3月期 決算短信", "", "当期（2025年3月期）の連結業績は次のとおりです。"), ["2025年3月期/2026年3月期"]);
  });

  it("stays silent on the stated period, comparisons and forecasts", () => {
    assert.deepEqual(foundJa(...title, "| 項目 | 前年同期 | 当第2四半期累計 |", "| --- | --- | --- |", "| 売上高 | 2,400 | 2,640 |"), []);
    assert.deepEqual(foundJa("# 2026年3月期 決算短信", "", "前期（2025年3月期）の業績と比べて増収でした。"), []);
    assert.deepEqual(foundJa("# 2026年3月期 決算短信", "", "次期（2027年3月期）は、売上高1,400百万円を見込みます。"), []);
    assert.deepEqual(foundJa("# 2026年3月期 決算短信", "", "| 項目 | 2025年3月期 | 2026年3月期 |", "| --- | --- | --- |", "| 売上高 | 1 | 2 |"), []);
    assert.deepEqual(foundJa("# 2026年3月期 決算短信", "", "## 4 次期の見通し", "", "当期に続き、2027年3月期の業績も伸びます。"), []);
  });

  it("stays silent on a whole second-quarter summary that names many other periods correctly", () => {
    assert.deepEqual(
      foundJa(
        ...title,
        "## 1 当第2四半期連結累計期間の経営成績",
        "",
        "当第2四半期連結累計期間の売上高は2,640百万円となりました。",
        "第1四半期連結会計期間より、新しい子会社を連結の範囲に含めております。",
        "前第2四半期連結累計期間の売上高は2,400百万円でした。",
        "前連結会計年度末（2026年3月期末）と比べ、総資産は120百万円増えました。",
        "2026年3月期の親会社株主に帰属する当期純利益は220百万円でした。",
        "",
        "| 項目 | 2026年3月期 第2四半期 | 2027年3月期 第2四半期 |",
        "| --- | --- | --- |",
        "| 売上高 | 2,400 | 2,640 |",
        "",
        "## 2 通期の見通し",
        "",
        "2027年3月期の業績は、売上高5,200百万円を見込みます。",
        "2028年3月期を最終年度とする中期経営計画を進めます。",
      ),
      [],
    );
  });

  it("stays silent on an earlier quarter inside the cumulative period and on a document that is not a results release", () => {
    assert.deepEqual(foundJa(...title, "第1四半期の業績は堅調でした。"), []);
    assert.deepEqual(foundJa("# 2027年3月期 第2四半期 事業計画", "", "当第3四半期累計の業績は次のとおりです。"), []);
  });
});

describe("period-label-conflict: English releases", () => {
  const title = ["# Second Quarter Results for the Fiscal Year Ending March 31, 2027", ""];
  it("reports another quarter in a table heading and another fiscal year in a results sentence", () => {
    assert.deepEqual(foundEn(...title, "| Item | Six months a year earlier | Q3 FY2027 (six months) |", "| --- | --- | --- |", "| Net sales | 1 | 2 |"), [
      "Q3/Second Quarter",
    ]);
    assert.deepEqual(foundEn("# Consolidated Financial Results for FY2026", "", "Consolidated results for FY2025 are shown below."), ["FY2025/FY2026"]);
  });

  it("a title naming the year by its end and as FY keeps both, and FY names compare with FY only", () => {
    assert.deepEqual(
      foundEn("# Second Quarter Results for the Fiscal Year Ending March 31, 2027 (FY2026)", "", "Consolidated results for FY2025 are shown below."),
      ["FY2025/FY2026"],
    );
    assert.deepEqual(foundEn("# Results for the Fiscal Year Ending March 31, 2027", "", "Consolidated results for FY2026 are shown below."), []);
  });

  it("a balance-sheet word with current in it is not a word for the current period", () => {
    assert.deepEqual(foundEn("# Consolidated Financial Report FY2026", "", "Current and non-current assets at the end of FY2025 were $500 million."), []);
  });

  it("stays silent on comparisons, the outlook and the stated period", () => {
    assert.deepEqual(
      foundEn("# Consolidated Financial Results for FY2026", "", "| Item | FY2025 | FY2026 |", "| --- | --- | --- |", "| Net sales | 1 | 2 |"),
      [],
    );
    assert.deepEqual(foundEn("# Consolidated Financial Results for FY2026", "", "Results improved compared with FY2025."), []);
    assert.deepEqual(foundEn("# Consolidated Financial Results for FY2026", "", "For FY2027, we expect net sales of $1,400 million."), []);
    assert.deepEqual(foundEn(...title, "Results for Q2 FY2027 were strong."), []);
    assert.deepEqual(foundEn("# Product roadmap FY2026", "", "Results for FY2025 are shown below."), []);
  });

  it("stays silent on a whole annual summary that names many other periods correctly", () => {
    assert.deepEqual(
      foundEn(
        "# Consolidated Financial Results for the Fiscal Year Ended March 31, 2026",
        "",
        "## 1 Results for the year",
        "",
        "Net sales for the fiscal year ended March 31, 2026 were $1,320 million.",
        "Sales in the fourth quarter were the highest of the year.",
        "Net sales rose 10.0% from $1,200 million in the year ended March 31, 2025.",
        "Current assets at the end of FY2025 were $500 million.",
        "",
        "| Item | Year ended March 31, 2025 | Year ended March 31, 2026 |",
        "| --- | --- | --- |",
        "| Net sales | 1,200 | 1,320 |",
        "",
        "## 2 Outlook",
        "",
        "For the fiscal year ending March 31, 2027, net sales are expected to reach $1,400 million.",
      ),
      [],
    );
  });
});

describe("period-label-conflict: reading a year a name marks", () => {
  const ERAS = [
    { name: "令和", firstYear: 2019 },
    { name: "平成", firstYear: 1989 },
  ];
  const YEAR_FRAMES = compileFrames([{ pattern: "{y}年分", kind: "tax-year", titleAlone: true }], ERAS);
  const years = (text: string): string[] => periodLabelsIn(text, YEAR_FRAMES).map((label) => `${label.value}:${String(label.titleAlone)}`);

  it("reads an era year as the Western year, the first year as 1", () => {
    assert.deepEqual(years("令和8年分"), ["y2026:true"]);
    assert.deepEqual(years("2026年分"), ["y2026:true"]);
    assert.deepEqual(years("令和元年分と平成31年分"), ["y2019:true", "y2019:true"]);
    assert.deepEqual(years("令和 ８ 年分"), ["y2026:true"]);
  });

  it("does not read a length of years, an unknown era or a year without the marker", () => {
    assert.deepEqual(years("3年分の記録"), []);
    assert.deepEqual(years("12026年分"), []);
    assert.deepEqual(years("天平8年分"), []);
    assert.deepEqual(years("2026年度"), []);
    assert.deepEqual(periodLabelsIn("令和8年分", compileFrames([{ pattern: "{y}年分", kind: "tax-year" }])), []);
  });

  it("a title without a results word gives only the names that mark a year by themselves", () => {
    const frames = compileFrames(
      [
        { pattern: "FY{y}", kind: "fiscal-year" },
        { pattern: "{y}年分", kind: "tax-year", titleAlone: true },
      ],
      ERAS,
    );
    const words = { ...WORDS, frames };
    assert.deepEqual(
      statedPeriodOf("令和8年分 源泉徴収票 FY2026", "", words).map((label) => label.written),
      ["令和8年分"],
    );
    assert.deepEqual(statedPeriodOf("源泉徴収票", "対象：2026年分", words), []);
  });
});

describe("period-label-conflict: a tax year a title names", () => {
  const ja = ["# 令和8年分 給与所得の年間明細書", "", "対象期間：2026年1月1日〜2026年12月31日", ""];
  const en = ["# Annual Pay and Tax Statement, Tax Year 2026", "", "Period covered: January 1, 2026 – December 31, 2026", ""];

  it("reports another year with the same marker anywhere in the body", () => {
    assert.deepEqual(foundJa(...ja, "2025年分の源泉徴収税額は、12月の給与で精算しました。"), ["2025年分/令和8年分"]);
    assert.deepEqual(foundJa("# 2026年分 給与の明細", "", "令和7年分の給与は次のとおりです。"), ["令和7年分/2026年分"]);
    assert.deepEqual(foundEn(...en, "Keep this statement with your records for tax year 2025."), ["tax year 2025/Tax Year 2026"]);
    assert.deepEqual(foundEn("# Pay Statement, 2026 Tax Year", "", "These are your earnings for the 2025 tax year."), ["2025 tax year/2026 Tax Year"]);
  });

  it("an era year and the same Western year are one year", () => {
    assert.deepEqual(foundJa(...ja, "2026年分の源泉徴収税額は、12月の給与で精算しました。"), []);
    assert.deepEqual(foundJa("# 2026年分 給与の明細", "", "令和8年分の給与は次のとおりです。"), []);
  });

  it("stays silent on the previous year as a comparison, a year without the marker and a prior-year column", () => {
    assert.deepEqual(foundJa(...ja, "前年分（2025年分）との比較は別紙のとおりです。"), []);
    assert.deepEqual(foundJa(...ja, "2025年の源泉徴収税額は別紙のとおりです。"), []);
    assert.deepEqual(foundJa(...ja, "| 項目 | 前年（2025年分） | 2026年分 |", "| --- | --- | --- |", "| 総支給額 | 1 | 2 |"), []);
    assert.deepEqual(foundEn(...en, "Withholding rose compared with 2025."), []);
    assert.deepEqual(foundEn(...en, "Your pay compared with tax year 2025 is on the next page."), []);
    assert.deepEqual(foundEn(...en, "| Item | Prior year (tax year 2025) | This year |", "| --- | --- | --- |", "| Gross pay | 1 | 2 |"), []);
  });

  it("stays silent on a carryforward from earlier years, a marker inside another word and a plain annual report", () => {
    assert.deepEqual(foundJa(...ja, "令和7年分以前から繰り越された損失額を記入します。"), []);
    assert.deepEqual(foundEn(...en, "You may carry forward losses from tax year 2025 or earlier."), []);
    assert.deepEqual(foundJa("# 令和8年分担金条例", "", "令和7年分担金の徴収方法を定めます。"), []);
    assert.deepEqual(foundJa("# 令和8年分所得税の確定申告の手引き", "", "2025年分所得税の申告は別の手引きです。"), ["2025年分/令和8年分"]);
    assert.deepEqual(foundEn("# Annual Report for the Year 2026", "", "Financial statements for the year 2025 are included."), []);
  });

  it("stays silent when the title names no year with the marker", () => {
    assert.deepEqual(foundJa("# 給与所得の年間明細書", "", "2025年分の源泉徴収税額は次のとおりです。"), []);
    assert.deepEqual(foundEn("# Annual Pay Statement 2026", "", "Keep this statement for tax year 2025."), []);
  });
});
