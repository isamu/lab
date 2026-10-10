import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { impossibleDates, type CalendarWords } from "../packages/chaff/src/detectors/impossible-date.ts";
import { loadLexicons as loadJaLexicons } from "../packages/lang-ja/src/lexicons.ts";
import { yearDisagreements } from "../packages/chaff/src/detectors/gloss-year.ts";
import type { StructureNode } from "../packages/chaff/src/plugin.ts";

// 暦に無い日付（impossible-date）。例文はすべて自作。

const RULE = "impossible-date";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const WORDS: CalendarWords = {
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Feb", "Sept"],
  units: ["年", "月", "日"],
  eras: ["令和"],
};

const writtenIn = (text: string): string[] => impossibleDates(text, WORDS).map((found) => `${found.written}:${found.reason}`);

describe("impossible-date: 暦に無い日付", () => {
  it("月に無い日（2月30日、4月31日）を言う", () => {
    assert.deepEqual(findingsOf("締切は 4月31日 です。\n"), ["「4月31日」は暦にありません（4月は30日まで）"]);
    assert.deepEqual(writtenIn("2月30日と9月31日と11月31日"), ["2月30日:day", "9月31日:day", "11月31日:day"]);
  });

  it("うるう年でない年の 2月29日を言い、うるう年なら言わない", () => {
    assert.deepEqual(writtenIn("2023年2月29日、2024年2月29日、1900年2月29日、2000年2月29日"), ["2023年2月29日:leap", "1900年2月29日:leap"]);
    assert.deepEqual(findingsOf("監査は 2023-02-29 に行います。\n", en), [
      '"2023-02-29" is not on the calendar (that year is not a leap year, so February has 28 days)',
    ]);
  });

  it("単位で書いた日付は、月が 1〜12 にない・日が 31 を超えるのも言う", () => {
    assert.deepEqual(writtenIn("13月1日と0月5日と5月32日"), ["13月1日:month", "0月5日:month", "5月32日:day"]);
  });

  it("英語の月の名前の日付（前と後ろ、略した名前）", () => {
    assert.deepEqual(findingsOf("Applications close on April 31.\n", en), ['"April 31" is not on the calendar (that month has 30 days)']);
    assert.deepEqual(writtenIn("on 31 September, Sept. 31 and Feb 30, 2024"), ["31 September:day", "Sept. 31:day", "Feb 30, 2024:day"]);
  });

  it("日時（T の後ろに時刻）の日付も読む", () => {
    assert.deepEqual(writtenIn("2023-02-29T10:00 と 2024-02-29T10:00"), ["2023-02-29:leap"]);
  });

  it("全角の数字も読む", () => {
    assert.deepEqual(writtenIn("２月３０日"), ["２月３０日:day"]);
  });

  it("暦にある日付は言わない", () => {
    assert.deepEqual(findingsOf("締切は 4月30日、発表は 2024年2月29日 です。\n"), []);
    assert.deepEqual(findingsOf("Applications close on April 30, 2026-10-31 at the latest.\n", en), []);
  });

  it("元号の年と年の無い日付では、2月29日をうるう年で決めない", () => {
    assert.deepEqual(writtenIn("令和5年2月29日と2月29日"), []);
  });

  it("数字だけの並びは、月が 12 を超えたり日が 31 を超えたりすれば番号として読まない", () => {
    assert.deepEqual(writtenIn("2026-13-45 と 2026/10/45 と 2026-02-31"), ["2026-02-31:day"]);
  });

  it("名前の月でも 31 を超える日は数として読まない。小文字の may は月ではない", () => {
    assert.deepEqual(writtenIn("In March 45 people came, and may 31 is fine."), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("例：`2023-02-29` は不正な値です。\n"), []);
  });

  it("空の文字列と語の無い言語", () => {
    assert.deepEqual(impossibleDates("", WORDS), []);
    assert.deepEqual(impossibleDates("2月30日 April 31", { months: [], units: [], eras: [] }), []);
  });
});

describe("impossible-date: 和暦と括弧の西暦が違う年（years）", () => {
  it("括弧の外と中が違う年を言う", () => {
    assert.deepEqual(findingsOf("説明会は令和6年（2023年）12月17日に開きます。\n"), [
      "「令和6年（2023年）12月17日」は和暦と西暦が違う年を指しています（括弧の外は2024年、中は2023年）",
    ]);
    assert.deepEqual(findingsOf("2024年（令和5年）に制定しました。\n"), [
      "「2024年（令和5年）」は和暦と西暦が違う年を指しています（括弧の外は2024年、中は2023年）",
    ]);
    assert.deepEqual(findingsOf("令和元年（2018年）5月1日に改元。\n"), [
      "「令和元年（2018年）5月1日」は和暦と西暦が違う年を指しています（括弧の外は2019年、中は2018年）",
    ]);
  });

  it("同じ年の言い換えは言わない", () => {
    assert.deepEqual(findingsOf("令和6年（2024年）12月17日、2019年（令和元年）5月1日、令和6（2024）年4月1日、平成31年(2019年)4月30日。\n"), []);
  });

  it("年度と、語彙表に無い元号は読まない", () => {
    assert.deepEqual(findingsOf("令和6年度（2023年度）の予算。令和6（2023）年度の決算。\n"), []);
    assert.deepEqual(findingsOf("天平6年（2023年）の記録。\n"), []);
  });

  it("英語の文書は括弧の年を読まないので何も言わない", () => {
    assert.deepEqual(findingsOf("It was signed in 2024 (2023).\n", en), []);
  });

  it("コード・引用・表の中は、ほかの日付と同じく読まない", () => {
    assert.deepEqual(findingsOf("例：\n\n```\n令和6年（2023年）12月17日\n```\n"), []);
    assert.deepEqual(findingsOf("> 令和6年（2023年）12月17日に開きます。\n"), []);
    assert.deepEqual(findingsOf("| 日付 | 内容 |\n| --- | --- |\n| 令和6年（2023年）12月17日 | 説明会 |\n"), []);
  });
});

const dateNode = (start: number, attrs: StructureNode["attrs"], kind: StructureNode["kind"] = "date"): StructureNode => ({
  kind,
  address: "",
  span: { start, end: start + 1 },
  line: 1,
  attrs,
  children: [],
});

describe("yearDisagreements（純粋）", () => {
  const tree = (...children: StructureNode[]): StructureNode => ({ ...dateNode(0, {}, "doc"), children });

  it("value の年と glossYear が違う日付だけを、文書の順に返す", () => {
    const found = yearDisagreements(
      tree(
        dateNode(5, { value: "2024-12-17", glossYear: 2023 }),
        dateNode(9, { value: "2024", glossYear: 2024 }),
        dateNode(12, { value: "2019", glossYear: 2018 }),
      ),
    );
    assert.deepEqual(
      found.map((date) => [date.offset, date.year, date.glossYear]),
      [
        [5, 2024, 2023],
        [12, 2019, 2018],
      ],
    );
  });

  it("glossYear が無い・数でない、年の無い value、日付でない節は読まない", () => {
    assert.deepEqual(
      yearDisagreements(
        tree(
          dateNode(1, { value: "2024-12-17" }),
          dateNode(2, { value: "2024", glossYear: "2023" }),
          dateNode(3, { value: "12-17", glossYear: 2023 }),
          dateNode(4, { glossYear: 2023 }),
          dateNode(5, { value: "2024", glossYear: 2023 }, "definition"),
        ),
      ),
      [],
    );
    assert.deepEqual(yearDisagreements(tree()), []);
  });
});

describe("impossible-date: 語彙表", () => {
  it("month-name の初めの十二は一月から順の月の名前", () => {
    const months = (loadJaLexicons()["month-name"] ?? []).map((entry) => entry.pattern).slice(0, 12);
    assert.equal(months[0], "January");
    assert.equal(months[11], "December");
  });
});
