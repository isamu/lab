import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { countedFacts, type CountedPhrase } from "../packages/chaff/src/facts/counted-facts.ts";
import type { FactValue } from "../packages/chaff/src/facts/fact-values.ts";

// 同じ項目に違う値（fact-conflict）と、冒頭や要約の値が本文と違う（summary-fact-mismatch）。

const RULES = { "fact-conflict": "normal", "summary-fact-mismatch": "normal" } as const;

const found = (rule: string, source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const conflictJa = (...lines: string[]): string[] => found("fact-conflict", ["# 案内", "", ...lines].join("\n"), ja, "ja");
const conflictEn = (...lines: string[]): string[] => found("fact-conflict", ["# Notice", "", ...lines].join("\n"), en, "en");
const summaryJa = (...lines: string[]): string[] => found("summary-fact-mismatch", lines.join("\n"), ja, "ja");
const summaryEn = (...lines: string[]): string[] => found("summary-fact-mismatch", lines.join("\n"), en, "en");

describe("fact-conflict", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("the same label with two values in one section (ja)", () => {
    assert.deepEqual(conflictJa("## 申し込み", "", "締切：10月5日", "", "- 参加費：3,000円", "- 締切：10月7日"), ["締切:10月7日≠10月5日"]);
    assert.deepEqual(conflictJa("## 申し込み", "", "締切：10月5日", "", "- 参加費：3,000円", "- 締切：10月5日"), []);
  });

  it("a label written with は and です, in full width or half width (ja)", () => {
    assert.deepEqual(conflictJa("参加費は3,000円です。会場は本館です。参加費は3,500円です。"), ["参加費:3,500円≠3,000円"]);
    assert.deepEqual(conflictJa("参加費は3,000円です。", "", "参加費は3000円です。"), []);
    assert.deepEqual(conflictJa("参加費：3,000円", "", "参加費：３５００円"), ["参加費:３５００円≠3,000円"]);
  });

  it("the same label with two values in one section (en)", () => {
    assert.deepEqual(conflictEn("Deadline: May 3, 2026", "", "- Fee: $300", "- Deadline: May 5, 2026"), ["Deadline:May 5, 2026≠May 3, 2026"]);
    assert.deepEqual(conflictEn("The fee is $300.", "", "Our fee is $350."), ["Our fee:$350≠$300"]);
    assert.deepEqual(conflictEn("The fee is $300.", "", "Our fee is $300."), []);
  });

  it("a table cell against the prose: the row heading is the label", () => {
    const table = (prose: string): string[] => conflictJa("| 区分 | 料金 |", "| --- | --- |", "| 大人 | 3,000円 |", "| 子供 | 1,000円 |", "", prose);
    assert.deepEqual(table("大人：3,500円"), ["大人:3,500円≠3,000円"]);
    assert.deepEqual(table("大人：3,000円"), []);
    const wide = conflictEn("| Group | Fee | Seats |", "| --- | --- | --- |", "| Adults | $30 | 40 |", "| Adults | $35 | 40 |");
    assert.deepEqual(wide, ["Adults Fee:$35≠$30"]);
  });

  it("an entity's attribute: headquartered in, に本社を置く", () => {
    assert.deepEqual(conflictEn("Acme is headquartered in Austin.", "", "The firm, headquartered in Dallas, grew."), ["headquartered in:Dallas≠Austin"]);
    assert.deepEqual(conflictEn("Acme is headquartered in Austin.", "", "Acme, headquartered in Austin, grew."), []);
    assert.deepEqual(conflictJa("当社は東京に本社を置く会社です。", "", "大阪に本社を置く当社は、創業から十年です。"), ["に本社を置:大阪≠東京"]);
  });

  it("values under different headings, parent items or bold lines are values of different things", () => {
    assert.deepEqual(conflictJa("## 第1回", "", "締切：10月5日", "", "## 第2回", "", "締切：10月12日"), []);
    assert.deepEqual(conflictJa("- 第1回", "  - 締切：10月5日", "- 第2回", "  - 締切：10月12日"), []);
    assert.deepEqual(conflictEn("**Session 1**", "", "- Deadline: May 3, 2026", "", "**Session 2**", "", "- Deadline: May 10, 2026"), []);
    assert.deepEqual(conflictEn("Session 1:", "", "- Deadline: May 3, 2026", "", "Session 2:", "", "- Deadline: May 10, 2026"), []);
  });

  it("a line continuing a list item belongs to that item", () => {
    const lines = [
      "- Trinidad is in maintenance mode.",
      "  Last release was 2017-09-01.",
      "- Tomahawk is in maintenance mode.",
      "  Last release was 2016-05-01.",
    ];
    assert.deepEqual(conflictEn(...lines), []);
    assert.deepEqual(conflictEn("Last release was 2017-09-01.", "", "Last release was 2016-05-01."), ["Last release:2016-05-01≠2017-09-01"]);
  });

  it("a label that heads many lines of one section is a field of repeated records", () => {
    assert.deepEqual(conflictEn("Seats: 30", "", "Seats: 40", "", "Seats: many"), []);
    assert.deepEqual(conflictEn("Seats: 30", "", "Seats: 40"), ["Seats:40≠30"]);
  });

  it("a value with a condition after it, or a label after a comma, is not read", () => {
    assert.deepEqual(conflictJa("参加費は3,000円からです。", "", "参加費は3,500円です。"), []);
    assert.deepEqual(conflictJa("大人は、参加費は3,000円です。", "", "子供は、参加費は1,000円です。"), []);
    assert.deepEqual(conflictEn("The fee is $300 per person.", "", "The fee is $350."), []);
    assert.deepEqual(conflictEn("For adults, the fee is $30.", "", "For children, the fee is $10."), []);
  });

  it("three or more values for one label are a list, not a slip", () => {
    assert.deepEqual(conflictEn("- Seats: 30", "- Seats: 40", "- Seats: 50"), []);
  });

  it("values in another unit, or dates of another precision, are not compared", () => {
    assert.deepEqual(conflictEn("Distance: 5 km", "", "Distance: 3000 m"), []);
    assert.deepEqual(conflictJa("締切：2026年10月5日", "", "締切：10月5日"), []);
    assert.deepEqual(conflictJa("締切：2026年10月5日", "", "締切：10月7日"), ["締切:10月7日≠2026年10月5日"]);
  });

  it("a value in another unit does not hide two values in one unit", () => {
    assert.deepEqual(conflictEn("The fee is €30.", "", "Fee: 3000", "", "Fee: 4000"), ["Fee:4000≠3000"]);
  });

  it("a longer label heading many lines does not make a shorter one a record field", () => {
    assert.deepEqual(conflictEn("Reserved seats: 1", "Reserved seats: 1", "Reserved seats: 1", "Seats: 10", "Seats: 20"), ["Seats:20≠10"]);
  });

  it("only the values that differ from the first are reported, and three values are a list", () => {
    assert.deepEqual(conflictEn("The fee is $300.", "", "The fee is $300.", "", "The fee is $350."), ["The fee:$350≠$300"]);
    assert.deepEqual(conflictEn("The fee is $300.", "", "The fee is $350.", "", "The fee is $400."), []);
  });

  it("a value in another unit is not a conflicting value", () => {
    assert.deepEqual(conflictEn("The fee is €30.", "", "The fee is $30."), []);
  });

  it("a label after a comma is not read even when the text before it repeats", () => {
    assert.deepEqual(conflictEn("Note, the fee is $30.", "", "Note, the fee is $35."), []);
  });

  it("a pronoun is not a label", () => {
    assert.deepEqual(conflictEn("It is $300.", "", "It is $350."), []);
    assert.deepEqual(conflictJa("それは3,000円です。", "", "それは3,500円です。"), []);
  });
});

describe("summary-fact-mismatch", () => {
  it("the opening against the body (ja)", () => {
    const doc = (opening: string): string[] => summaryJa("# 説明会", "", opening, "", "## 申し込み", "", "参加費は3,500円です。");
    assert.deepEqual(doc("参加費は3,000円です。"), ["参加費:3,000円≠3,500円"]);
    assert.deepEqual(doc("参加費は3,500円です。"), []);
  });

  it("a report's body that goes on after the value (「48社で、」) and a summary in the past (「52社だった」) (ja)", () => {
    const doc = (summary: string): string[] =>
      summaryJa("# 営業報告", "", "## 概要", "", summary, "", "## 取引先", "", "新規の取引先は48社で、そのうち32社が首都圏の企業だった。");
    assert.deepEqual(doc("新規の取引先は52社だった。"), ["新規の取引先:52社≠48社"]);
    assert.deepEqual(doc("新規の取引先は48社だった。"), []);
    // 「で」のあとが読点でなければ、値の続き（「3,000円で購入」）で、項目の値ではない。
    assert.deepEqual(summaryJa("# 報告", "", "## 概要", "", "単価は3,000円だった。", "", "## 詳細", "", "単価は3,500円で購入した。"), []);
  });

  it("a summary section against the body (en)", () => {
    const doc = (summary: string): string[] => summaryEn("# Report", "", "## Summary", "", summary, "", "## Details", "", "- Seats: 40");
    assert.deepEqual(doc("- Seats: 30"), ["Seats:30≠40"]);
    assert.deepEqual(doc("- Seats: 40"), []);
  });

  it("a body that gives the label two values settles nothing", () => {
    const lines = ["# Report", "", "Seats: 30", "", "## First", "", "Seats: 40", "", "## Second", "", "Seats: 50"];
    assert.deepEqual(summaryEn(...lines), []);
  });

  it("a summary value with no label, named by its verb and what it counts (en)", () => {
    const doc = (summary: string, body: string): string[] => summaryEn("# Report", "", "## Summary", "", summary, "", "## Customers", "", body);
    assert.deepEqual(doc("We gained 52 new customers.", "We gained 48 new customers, 32 of them in the capital region."), ["new customers:52≠48"]);
    assert.deepEqual(doc("We gained 48 new customers.", "We gained 48 new customers, 32 of them in the capital region."), []);
  });

  it("a counted value is paired only with the same verb and the same noun", () => {
    const doc = (summary: string, body: string): string[] => summaryEn("# Report", "", "## Summary", "", summary, "", "## Details", "", body);
    assert.deepEqual(doc("We interviewed 12 people.", "In the end, 3 people declined."), []);
    assert.deepEqual(doc("We interviewed 12 people.", "We interviewed 10 managers."), []);
    assert.deepEqual(doc("We gained 52 new customers.", "We gained 48 new customers in May and 30 new customers in June."), []);
    assert.deepEqual(doc("We reported 2026 revenue.", "We reported 2025 revenue."), []);
    assert.deepEqual(doc("We gained 52 in the region.", "We gained 48 in the region."), []);
    assert.deepEqual(doc("The count we gained was 52 new.", "The count we gained was 48 new."), []);
    assert.deepEqual(doc("North America gained 52 customers.", "Europe gained 48 customers."), []);
    assert.deepEqual(doc("We selected 2 proposals.", "We selected 1 of 3 proposals."), []);
    assert.deepEqual(doc("We gained 15 customers.", "We gained between 10 and 12 customers."), []);
    assert.deepEqual(doc("Gained 15 customers.", "Gained 12 customers."), []);
  });

  it("the counted words are compared by their lemma, so one and many are the same thing", () => {
    const doc = (summary: string, body: string): string[] => summaryEn("# Report", "", "## Summary", "", summary, "", "## Details", "", body);
    assert.deepEqual(doc("We gained 1 new customer.", "We gained 2 new customers."), ["new customer:1≠2"]);
  });

  it("a document with no headings has no body to compare with", () => {
    assert.deepEqual(summaryJa("参加費は3,000円です。", "", "参加費は3,500円です。"), []);
  });
});

describe("summary-fact-mismatch: a summary's change against the body's two conditions", () => {
  const paperEn = (abstract: string, ...body: string[]): string[] => summaryEn("# Study", "", "## Abstract", "", abstract, "", "## Results", "", ...body);
  const paperJa = (abstract: string, ...body: string[]): string[] => summaryJa("# 調査", "", "## 要旨", "", abstract, "", "## 結果", "", ...body);
  const withBreaks = "Without breaks, the error rate was 2.4%; with breaks, it was 1.6%.";
  const 休憩 = "休憩が無いときの誤りの率は 2.4%、休憩があるときは 1.6% だった。";

  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a matching pair is silent (en, ja)", () => {
    assert.deepEqual(paperEn("Breaks lowered the error rate from 2.4% to 1.6%.", withBreaks), []);
    assert.deepEqual(paperJa("休憩を入れると、誤りの率は 2.4% から 1.6% に下がった。", 休憩), []);
  });

  it("a wrong or swapped pair is reported (en, ja)", () => {
    assert.deepEqual(paperEn("Breaks lowered the error rate from 2.4% to 1.4%.", withBreaks), ["error rate:2.4% → 1.4%≠2.4% → 1.6%"]);
    assert.deepEqual(paperEn("Breaks raised the error rate from 1.6% to 2.4%.", withBreaks), ["error rate:1.6% → 2.4%≠2.4% → 1.6%"]);
    assert.deepEqual(paperJa("休憩を入れると、誤りの率は 2.4% から 1.4% に下がった。", 休憩), ["誤りの率:2.4% → 1.4%≠2.4% → 1.6%"]);
    assert.deepEqual(paperJa("休憩を入れると、誤りの率は 1.6% から 2.4% に上がった。", 休憩), ["誤りの率:1.6% → 2.4%≠2.4% → 1.6%"]);
  });

  it("the condition may follow the value, and the value of the later condition may come first", () => {
    const body = "The error rate was 1.6% with breaks, and 2.4% without them.";
    assert.deepEqual(paperEn("Breaks lowered the error rate from 2.4% to 1.6%.", body), []);
    assert.deepEqual(paperEn("Breaks lowered the error rate from 2.4% to 1.2%.", body), ["error rate:2.4% → 1.2%≠2.4% → 1.6%"]);
  });

  it("before and after, control and treatment, 導入前 and 導入後", () => {
    const before = "Before the change, the error rate was 2.4%; after it, the rate was 1.6%.";
    assert.deepEqual(paperEn("The change cut the error rate from 2.4% to 1.4%.", before), ["error rate:2.4% → 1.4%≠2.4% → 1.6%"]);
    const arms = "In the control group the error rate was 2.4%, and in the treatment group 1.6%.";
    assert.deepEqual(paperEn("The error rate fell from 2.4% to 1.6%.", arms), []);
    assert.deepEqual(paperEn("The error rate fell from 3.4% to 1.6%.", arms), ["error rate:3.4% → 1.6%≠2.4% → 1.6%"]);
    const 導入 = "導入前の待ち時間は 30 分、導入後は 12 分だった。";
    assert.deepEqual(paperJa("新しい受付で、待ち時間は 30 分から 12 分に縮んだ。", 導入), []);
    assert.deepEqual(paperJa("新しい受付で、待ち時間は 30 分から 15 分に縮んだ。", 導入), ["待ち時間:30 分 → 15 分≠30 分 → 12 分"]);
  });

  it("two years: the earlier one is where the change starts", () => {
    const years = "In 2026 the error rate was 1.6%; in 2025 it was 2.4%.";
    assert.deepEqual(paperEn("The error rate fell from 2.4% to 1.6%.", years), []);
    assert.deepEqual(paperEn("The error rate fell from 2.4% to 1.8%.", years), ["error rate:2.4% → 1.8%≠2.4% → 1.6%"]);
    // 条件と値の順が入り組むと、どの値がどの年のものか決めない。
    assert.deepEqual(paperEn("The error rate fell from 2.4% to 1.8%.", "In 2026 the error rate was 1.6%, against 2.4% in 2025."), []);
    assert.deepEqual(paperJa("誤りの率は 2.4% から 1.8% に下がった。", "2025年の誤りの率は 2.4%、2026年は 1.6% だった。"), [
      "誤りの率:2.4% → 1.8%≠2.4% → 1.6%",
    ]);
  });

  it("the body may state the change itself", () => {
    assert.deepEqual(paperEn("The error rate fell from 2.4% to 1.4%.", "Over the study, the error rate fell from 2.4% to 1.6%."), [
      "error rate:2.4% → 1.4%≠2.4% → 1.6%",
    ]);
  });

  it("silent when the subject, a condition, or one settled pair is missing", () => {
    assert.deepEqual(paperEn("The response time fell from 2.4% to 1.4%.", withBreaks), []);
    assert.deepEqual(paperEn("Breaks lowered the error rate from 2.4% to 1.4%.", "The error rate was 2.4% in the morning and 1.6% in the afternoon."), []);
    assert.deepEqual(
      paperEn("The error rate fell from 2.4% to 1.4%.", withBreaks, "", "Before training, the error rate was 3.0%; after it, the rate was 2.0%."),
      [],
    );
    assert.deepEqual(
      paperEn("Fees for the error rate study ranged from $10 to $25.", "Without breaks, the error rate study cost $10; with breaks, it cost $20."),
      [],
    );
    assert.deepEqual(paperJa("誤りの率は 2.4% から 1.4% に下がった。", "誤りの率は午前が 2.4%、午後が 1.6% だった。"), []);
    const summary = "Breaks lowered the error rate from 2.4% to 1.4%.";
    // 条件が値をまたぐと（with … without … 2.4% … 1.6%）、どの値がどの条件のものか決めない。
    assert.deepEqual(paperEn(summary, "With breaks, against 2.4% without them, the error rate was 1.6%."), []);
    assert.deepEqual(paperEn(summary, "The error rate was 1.6% with breaks and 2.4% without them."), []);
    // 日付の中の年（2011-10-26）は年の条件ではない。
    assert.deepEqual(paperEn(summary, "From 2011-10-26 the error rate was 2.4%; in 2026 it was 1.6%."), []);
    // 同じ側の語が二つ（before と before）、二つの組が食い違う（before/after と with/without）ときも決めない。
    assert.deepEqual(paperEn(summary, "Before the change the error rate was 2.4%, and before the audit it was 1.6%."), []);
    assert.deepEqual(paperEn(summary, "Before the change the error rate was 2.4% with old screens, and after it 1.6% without them."), []);
    assert.deepEqual(paperJa("妊婦健診は 24 週から 35 週まで受けられる。", "健診が無いときの週は 24 週、あるときは 30 週。"), []);
  });

  it("the name is matched as a whole name, not as a part of another one", () => {
    // 本文の変化は、その変化の名前が要約の名前と同じときだけ。同じ文に名前が出てくるだけでは組にしない。
    const tracked = "The error rate was tracked; the completion rate rose from 70% to 80%.";
    assert.deepEqual(paperEn("The error rate fell from 2.4% to 1.6%.", tracked), []);
    // "rate" は "error rate" の一部で、同じ項目ではない。
    const calibration = "Before calibration, the error rate was 3%; after calibration, it was 2%.";
    assert.deepEqual(paperEn("In the primary metric, the rate increased from 10% to 20%.", calibration), []);
    // 「の」の前の修飾（「無いときの」）は落としてよい。英語の of の前後は落とさない。
    assert.deepEqual(paperJa("誤りの率は 2.4% から 1.4% に下がった。", 休憩), ["誤りの率:2.4% → 1.4%≠2.4% → 1.6%"]);
    assert.deepEqual(paperEn("Errors fell from 40 to 25.", "Before the change, the number of errors was 40; after it, 30."), []);
  });

  it("the body's change is not compared with itself, and an unrelated from … to stays silent", () => {
    assert.deepEqual(summaryEn("# Study", "", "## Results", "", "The error rate fell from 2.4% to 1.4%.", "", withBreaks), []);
    assert.deepEqual(paperEn("The office moved from Austin to Dallas.", withBreaks), []);
  });
});

describe("countedFacts: a number named by what it counts", () => {
  const bare = (source: string, written: string, unit = ""): FactValue => {
    const start = source.indexOf(written);
    return { start, end: start + written.length, kind: "quantity", key: written, unit };
  };
  const phrase = (source: string, label: string): CountedPhrase => {
    const start = source.indexOf(label);
    return { start, end: start + label.length, label, key: `counted ${label.toLowerCase()}` };
  };
  const keys = (source: string, values: readonly FactValue[], phrases: readonly CountedPhrase[]): string[] =>
    countedFacts(source, values, phrases).map((fact) => `${fact.label}=${fact.value.key}|${fact.key}`);

  it("a number with no unit, one space, then the counted words", () => {
    const source = "We gained 52 New Customers.";
    assert.deepEqual(keys(source, [bare(source, "52")], [phrase(source, "New Customers")]), ["New Customers=52|counted new customers"]);
  });

  it("not a number with a unit, a year, or one not right before the words", () => {
    const withUnit = "We gained $52 customers.";
    assert.deepEqual(keys(withUnit, [bare(withUnit, "52", "$")], [phrase(withUnit, "customers")]), []);
    const year = "We reported 2026 revenue.";
    assert.deepEqual(keys(year, [bare(year, "2026")], [phrase(year, "revenue")]), []);
    const apart = "We gained 52  customers.";
    assert.deepEqual(keys(apart, [bare(apart, "52")], [phrase(apart, "customers")]), []);
    const date: FactValue = { start: 0, end: 2, kind: "date", key: "2026-05-01", unit: "" };
    assert.deepEqual(keys("05 customers", [date], [phrase("05 customers", "customers")]), []);
    assert.deepEqual(keys("", [], []), []);
  });
});
