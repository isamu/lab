import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { calendarUnitsOf } from "../packages/chaff/src/calendar-number.ts";
import { chronologyRowIndexes, opensWithDateStamp } from "../packages/chaff/src/chronology-rows.ts";

// 年表の行（日付のすぐ後ろに出来事）は本文の文として数えない。例文はすべて自作。

const units = calendarUnitsOf(buildDocument("t.md", "", ja));
const opens = (text: string): boolean => opensWithDateStamp(text, units);

describe("opensWithDateStamp: 年から始まる日付のすぐ後ろに出来事", () => {
  it("年・年月・年月日、全角の数、元号、空白、見出しの札の後ろ", () => {
    assert.equal(opens("1950年4月 設立。"), true);
    assert.equal(opens("1950年４月本社工場を新設。"), true);
    assert.equal(opens("1962年営業部を新設する。"), true);
    assert.equal(opens("1971年10月1日　東京事務所を開設。"), true);
    assert.equal(opens("昭和48年3月 社名を変更。"), true);
    assert.equal(opens("２【沿革】1950年4月 設立。"), true);
  });

  it("日付の後ろに助詞・句読点が続く文、年度、桁の少ない年、日付で始まらない文は行ではない", () => {
    assert.equal(opens("2020年4月に新工場を建てました。"), false);
    assert.equal(opens("2020年４月、新工場を建てました。"), false);
    assert.equal(opens("2020年は売上が伸びた。"), false);
    assert.equal(opens("2020年度売上高は前年を上回った。"), false);
    assert.equal(opens("3年連続で増収となった。"), false);
    assert.equal(opens("新工場は1950年4月に完成。"), false);
    assert.equal(opens("1950年4月"), false);
    assert.equal(opens(""), false);
  });
});

describe("chronologyRowIndexes: 続けて 3 行以上で年表、間の注記も含める", () => {
  it("3 行以上並べば、行と間の注記", () => {
    assert.deepEqual([...chronologyRowIndexes([true, true, true])], [0, 1, 2]);
    assert.deepEqual([...chronologyRowIndexes([false, true, false, true, true, false])], [1, 2, 3, 4]);
  });

  it("2 行まで、間が空きすぎた行、空の並びは年表ではない", () => {
    assert.deepEqual([...chronologyRowIndexes([true, false, true])], []);
    assert.deepEqual([...chronologyRowIndexes([true, true, false, false, false, false, false, true])], []);
    assert.deepEqual([...chronologyRowIndexes([])], []);
  });
});

describe("taigen-dome-in-prose と no-mixed-desumasu: 年表の行は本文の文ではない", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const findingsOf = (rule: string, source: string): readonly string[] => namedRuleRun(rule, source, ja, "a.md").findings;

  const history = [
    "## 沿革",
    "",
    "1950年4月 東京都港区に設立。1955年6月 大阪営業所を開設。当時の主力製品は木製家具。1962年3月 本社工場を新設する。",
    "1970年10月 株式を店頭登録。1985年4月 社名を変更する。1991年7月 物流センターを開設。",
    "",
    "## 事業の内容",
    "",
    "当社は家具の製造と販売を行っております。主な顧客は国内の小売店です。",
    "",
  ].join("\n");

  it("年表の名詞止めの行も、言い切りの行も数えない", () => {
    assert.deepEqual(findingsOf("taigen-dome-in-prose", history), []);
    assert.deepEqual(findingsOf("no-mixed-desumasu", history), []);
  });

  it("本文の体言止めは、日付で始まる文が混ざっても数える", () => {
    const prose = [
      "今年の目標は売上の回復。2020年に始めた施策は三つ。最初は品ぞろえの見直し。次は店頭の改装。最後は配送の短縮。",
      "どれも来年までの課題。",
      "",
    ].join("\n");
    assert.equal(findingsOf("taigen-dome-in-prose", prose).length, 1);
  });

  it("日付で始まっても主題を立てた文は本文で、体言止めも文体の混ざりも数える", () => {
    const yearly =
      "2020年3月期売上高は100億円。2021年3月期売上高は110億円。2022年3月期売上高は120億円。2023年3月期営業利益は10億円。2024年3月期営業利益は12億円。";
    assert.equal(findingsOf("taigen-dome-in-prose", yearly).length, 1);
    const mixed = "2020年売上高は100億円です。2021年売上高は110億円です。2022年売上高は120億円です。2023年売上高は125億円です。2024年売上高は130億円だった。";
    assert.equal(findingsOf("no-mixed-desumasu", mixed).length, 1);
  });

  it("本文の文体の混ざりは、年表があっても指す", () => {
    const mixed = [history, "設備の更新は来年に行います。人員は増やしません。在庫は減らす。", ""].join("\n");
    assert.equal(findingsOf("no-mixed-desumasu", mixed).length, 1);
  });
});
