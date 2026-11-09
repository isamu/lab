import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { minorityStyles, numberMarksIn, ownMarks, type NumberMark, type NumberWords } from "../packages/chaff/src/detectors/number-style.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// number-style-consistency: one document writing one kind of number two ways. Every example is self-written.

const RULE = "number-style-consistency";

const findingsOf = (adapter: LanguageAdapter, source: string, genre = "blog/tech"): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter((finding) => finding.rule === RULE);

const flagged = (adapter: LanguageAdapter, source: string, genre?: string): string[] =>
  findingsOf(adapter, source, genre).map((finding) => `${finding.variant ?? ""}:${String(finding.values["written"])}`);

const wordsOf = (adapter: LanguageAdapter): NumberWords => {
  const patterns = (id: string): string[] => (adapter.lexicons[id] ?? []).map((entry) => entry.pattern);
  return {
    counters: patterns("numeral-counter"),
    kanji: patterns("numeral-kanji"),
    percentUnits: patterns("percent-unit"),
    countWords: patterns("count-number"),
    figureNouns: patterns("figure-noun"),
    nameWords: patterns("number-name-word"),
  };
};

/** The marks in a one-sentence document, as kind:style:written. */
const marksOf = (adapter: LanguageAdapter, sentence: string): string[] => {
  const doc = buildDocument("t.md", `${sentence}\n`, adapter);
  return doc.sentences
    .flatMap((entry) => numberMarksIn(entry, wordsOf(adapter), adapter.id, doc.source))
    .map((mark) => `${mark.kind}:${mark.style}:${mark.written}`);
};

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("numberMarksIn: Japanese", () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ["問い合わせは 3件です。", ["count:digits:3件"]],
    ["問い合わせは三件です。", ["count:kanji:三件"]],
    ["参加者は二十五人でした。", ["count:kanji:二十五人"]],
    ["全部で３つあります。", []],
    ["全部で３件あります。", ["count:digits:３件"]],
    ["約3万人が来ました。", []],
    ["来場は3万人でした。", ["count:digits:3万人"]],
    ["一つ目の案です。", []],
    ["万人に向けた本です。", []],
    ["第三回の会議です。", []],
    ["三日に会います。", []],
    ["「三件」と書きます。", []],
    ["費用は 1,500円です。", ["count:digits:1,500円", "grouping:grouped:1,500"]],
    ["費用は 3000円です。", ["count:digits:3000円", "grouping:plain:3000"]],
    ["費用は 30000 円です。", ["count:digits:30000 円", "grouping:plain:30000"]],
    ["誤りは 3,件です。", []],
    ["2019年に始めました。", []],
    ["番号は 12345 です。", []],
    ["電話は 03-1234-5678 です。", []],
    ["割合は 12% です。", ["percent:%:12%"]],
    ["割合は 12％ です。", ["percent:％:12％"]],
    ["割合は 12パーセントです。", ["percent:パーセント:12パーセント"]],
    ["割合は 0.05％ です。", ["percent:％:0.05％"]],
    ["三　人事委員会の委員である者", []],
    ["2 人事部に届け出た者", []],
    ["一　件名を書いた者", []],
    ["三人が来ました。", ["count:kanji:三人"]],
    ["3 人が来ました。", ["count:digits:3 人"]],
    ["3 人来ました。", ["count:digits:3 人"]],
    ["三　人が来ました。", ["count:kanji:三　人"]],
    ["3人事務員がいます。", ["count:digits:3人"]],
    ["汚染された二枚貝があります。", []],
    ["二枚舌を使う人です。", []],
    ["三人称で書きます。", []],
    ["三枚目の資料です。", ["count:kanji:三枚"]],
    ["二枚の資料です。", ["count:kanji:二枚"]],
  ];
  cases.forEach(([sentence, marks]) => {
    it(`${sentence} → ${marks.join(", ") || "none"}`, () =>
      assert.deepEqual(
        marksOf(ja, sentence).toSorted((left, right) => left.localeCompare(right)),
        [...marks].toSorted((left, right) => left.localeCompare(right)),
      ));
  });
});

describe("numberMarksIn: English", () => {
  const cases: readonly (readonly [string, readonly string[]])[] = [
    ["We fixed three bugs.", ["count-small:words:three"]],
    ["We fixed 3 bugs.", ["count-small:digits:3"]],
    ["We fixed 11 bugs.", ["count-large:digits:11"]],
    ["We fixed eleven bugs.", ["count-large:words:eleven"]],
    ["Three bugs were fixed.", []],
    ["We fixed one bug.", []],
    ["It took 6 months.", []],
    ["We fixed 25 bugs.", []],
    ["The fund paid $12,500 to members.", ["grouping:grouped:12,500"]],
    ["The fund paid $12500 to members.", ["grouping:plain:12500"]],
    ["It is in the 2019 annual report.", []],
    ["It is in the 12500 annual report.", ["grouping:plain:12500"]],
    ["See H.R. 5376 for details.", []],
    ["Our Grade 5 students leave at eight.", []],
    ["The Year 9 pupils and the Class 3 parents meet.", []],
    ["Guests at Table 4 and Room 12 guests wait.", []],
    ["Take Bus 2 seats from Gate 7 and Platform 3 trains.", []],
    ["See No. 5 entries and Chapter 2 notes.", []],
    ["The Day 1 sessions and Week 2 lessons are short.", []],
    ["Every day 3 buses leave.", ["count-small:digits:3"]],
    ["This week 5 students joined.", ["count-small:digits:5"]],
    ["The grade 5 students joined.", ["count-small:digits:5"]],
    ["Gradebook 5 entries are new.", ["count-small:digits:5"]],
    ["Turnout rose 12% in March.", ["percent:%:12%"]],
    ["Turnout rose 12 percent in March.", ["percent:percent:12 percent"]],
    ["We used commit 2704b2d of the repository.", []],
    ["The fix is in 5678ab9c and later.", []],
    ["The fund paid $12500 to 3 members.", ["grouping:plain:12500", "count-small:digits:3"]],
    ["We counted 12500 deaf voters.", ["grouping:plain:12500"]],
    ["The fund paid $12500cafe to members.", ["grouping:plain:12500"]],
  ];
  cases.forEach(([sentence, marks]) => {
    it(`${sentence} → ${marks.join(", ") || "none"}`, () =>
      assert.deepEqual(
        marksOf(en, sentence).toSorted((left, right) => left.localeCompare(right)),
        [...marks].toSorted((left, right) => left.localeCompare(right)),
      ));
  });
});

describe("minorityStyles: the usual style and the odd ones", () => {
  const mark = (style: string, written = style): NumberMark => ({ kind: "percent", style, written, offset: 0 });
  it("is none with one style", () => assert.deepEqual(minorityStyles([mark("%"), mark("%")], 34).odd, []));
  it("finds the one odd style", () => assert.deepEqual(minorityStyles([mark("%"), mark("%"), mark("％")], 34).odd, [mark("％")]));
  it("counts every other style against the usual one", () =>
    assert.deepEqual(minorityStyles([mark("%"), mark("%"), mark("%"), mark("%"), mark("％"), mark("パーセント")], 34).odd, [mark("％"), mark("パーセント")]));
  it("is none when the odd ones are too many to be slips", () => assert.deepEqual(minorityStyles([mark("%"), mark("％")], 49).odd, []));
  it("breaks a tie by the style used first", () =>
    assert.equal(minorityStyles([mark("％"), mark("%"), mark("%"), mark("％"), mark("x")], 49).usual?.style, "％"));
  it("is none for no marks", () => assert.deepEqual(minorityStyles([], 34), { odd: [], usual: undefined }));
});

describe("number-style-consistency: the minority style in a document", () => {
  it("reports a kanji count among digit counts", () =>
    assert.deepEqual(flagged(ja, "# 件数\n\n今月は 12件、先月は 9件、先々月は 7件でした。うち三件は同じ内容です。\n"), ["count:三件"]));

  it("does not read a quoted item number (三　人事委員会) as a kanji count, and still reports one beside it", () => {
    const items = "# 欠格\n\n応募者は 3人、合格者は 2人、辞退者は 1人です。\n\n二　禁錮以上の刑に処せられた者\n\n三　人事委員会の委員の職にあった者\n";
    assert.deepEqual(flagged(ja, items), []);
    assert.deepEqual(flagged(ja, `${items}\n補欠は三人です。\n`), ["count:三人"]);
  });

  it("reports a plain large number among grouped ones", () =>
    assert.deepEqual(flagged(ja, "# 費用\n\n参加費は 1,500円、資料代は 2,000円、懇親会は 3000円です。\n"), ["grouping:3000"]));

  it("reports a spelled-out percent among signs", () =>
    assert.deepEqual(flagged(en, "# Turnout\n\nTurnout rose 12% in March and 9% in April, and fell 3 percent in May.\n"), ["percent:3 percent"]));

  it("reports digits among spelled-out small counts", () =>
    assert.deepEqual(flagged(en, "# Release\n\nWe fixed three bugs, closed four issues and added two pages. The release also adds 5 tests.\n"), [
      "count-small:5",
    ]));

  it("does not count a number that names a group (Grade 5 students) among spelled-out counts", () =>
    assert.deepEqual(flagged(en, "# Camp\n\nOur Grade 5 students will spend two days at the camp with three teachers and four parents.\n"), []));

  it("does not count a section number after a section sign (§4 flags) among spelled-out counts", () =>
    assert.deepEqual(flagged(en, "# Plan\n\nWe set out two rules and three duties here, and §4 flags four questions for later.\n"), []));

  it("does not count nights, a measure of a stay, among spelled-out counts", () =>
    assert.deepEqual(flagged(en, "# Trip\n\nWe met two clients and three partners. Hotel (2 nights) $410, paid in four parts.\n"), []));

  it("still reports a digit count beside a named group", () =>
    assert.deepEqual(flagged(en, "# Camp\n\nOur Grade 5 students will bring two bags and three hats. Each class also brings 4 tents.\n"), ["count-small:4"]));

  it("places an English count on its own line", () => {
    const source = "# Release\n\nWe fixed three bugs and closed four issues.\n\nWe added two pages and six notes.\n\nThe release also adds 5 tests.\n";
    assert.deepEqual(
      findingsOf(en, source).map((finding) => [finding.line, finding.values["offset"]]),
      [[7, source.indexOf("5 tests")]],
    );
  });

  it("names the usual style and the tally", () => {
    const finding = findingsOf(ja, "# 件数\n\n今月は 12件、先月は 9件、先々月は 7件でした。うち三件は同じ内容です。\n")[0];
    assert.equal(finding?.values["usual"], "12件");
    assert.equal(finding?.values["count"], 1);
    assert.equal(finding?.values["of"], 4);
  });

  it("does not report a style that spells out small numbers and writes larger ones in figures", () =>
    assert.deepEqual(flagged(en, "# Release\n\nWe fixed three bugs and four issues, and added 25 tests and 40 pages.\n"), []));

  it("does not report a document that uses both styles evenly", () =>
    assert.deepEqual(flagged(ja, "# 件数\n\n今月は 12件、先月は 9件でした。うち三件と四件は同じ内容です。\n"), []));

  it("does not run in a contract or in fiction", () => {
    const source = "# 件数\n\n今月は 12件、先月は 9件、先々月は 7件でした。うち三件は同じ内容です。\n";
    assert.deepEqual(flagged(ja, source, "legal/contract"), []);
    assert.deepEqual(flagged(ja, source, "literature/fiction"), []);
  });
});

describe("number-style-consistency: articles a document quotes", () => {
  const fees = "# 手数料\n\n申請は 1件ごとに 2,400円、書面は 1枚ごとに 800円です。2件をまとめても 2,400円、3件なら 4,800円です。\n\n";
  const order = "第5条　手数料の額は、一件につき二千四百円に書面一枚につき八百円とする。二件以上は合計額とする。\n";

  it("leaves out the numbers of an article set out in a manual (a fee order quoted under its own heading)", () =>
    assert.deepEqual(flagged(ja, `${fees}## 根拠条文（抜粋）\n\n${order}`, "docs/manual"), []));

  it("still reports the same kanji counts written in the manual's own text", () =>
    assert.deepEqual(flagged(ja, `${fees}## 補足\n\n手数料の額は、二千四百円に八百円を足した額です。\n`, "docs/manual"), ["count:二千四百円", "count:八百円"]));

  it("compares the numbers under numbered headings of the document's own outline (2.1 Results)", () => {
    const paper =
      "# Report\n\nTurnout was 40% last year, 38% the year before, 35% before that and 30% at first.\n\n## 1 Method\n\nWe count votes.\n\n## 2 Results\n\n### 2.1 Turnout\n\nTurnout rose 12% in March and fell 3 percent in May.\n";
    assert.deepEqual(flagged(en, paper, "academic/paper"), ["percent:3 percent"]);
  });

  it("compares the numbers of a document written in articles (work rules)", () => {
    const rules =
      "第1条　休暇は年 10日とする。\n\n第2条　申請は 3日前までとする。\n\n第3条　届出は 2回までとする。\n\n第4条　延長は 5回までとする。\n\n第5条　更新は三回までとする。\n";
    assert.deepEqual(flagged(ja, rules, "docs/manual"), ["count:三回"]);
  });
});

describe("ownMarks", () => {
  const mark = (offset: number): NumberMark => ({ kind: "count", style: "digits", written: "3件", offset });
  const article = [{ start: 100, end: 200 }];

  it("drops the marks inside articles when most marks are outside", () =>
    assert.deepEqual(ownMarks([mark(0), mark(10), mark(150)], article), [mark(0), mark(10)]));

  it("keeps every mark when most are inside articles, or half are", () => {
    assert.deepEqual(ownMarks([mark(0), mark(120), mark(150)], article), [mark(0), mark(120), mark(150)]);
    assert.deepEqual(ownMarks([mark(0), mark(150)], article), [mark(0), mark(150)]);
  });

  it("keeps every mark without articles, and is empty for no marks", () => {
    assert.deepEqual(ownMarks([mark(0), mark(150)], []), [mark(0), mark(150)]);
    assert.deepEqual(ownMarks([], article), []);
  });
});
