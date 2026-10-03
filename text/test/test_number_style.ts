import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { minorityStyles, numberMarksIn, type NumberMark, type NumberWords } from "../packages/chaff/src/detectors/number-style.ts";
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
    ["Turnout rose 12% in March.", ["percent:%:12%"]],
    ["Turnout rose 12 percent in March.", ["percent:percent:12 percent"]],
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

  it("reports a plain large number among grouped ones", () =>
    assert.deepEqual(flagged(ja, "# 費用\n\n参加費は 1,500円、資料代は 2,000円、懇親会は 3000円です。\n"), ["grouping:3000"]));

  it("reports a spelled-out percent among signs", () =>
    assert.deepEqual(flagged(en, "# Turnout\n\nTurnout rose 12% in March and 9% in April, and fell 3 percent in May.\n"), ["percent:3 percent"]));

  it("reports digits among spelled-out small counts", () =>
    assert.deepEqual(flagged(en, "# Release\n\nWe fixed three bugs, closed four issues and added two pages. The release also adds 5 tests.\n"), [
      "count-small:5",
    ]));

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
