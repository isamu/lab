import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { fullNameGaps, joinFullNames, spacedOnly } from "../packages/chaff/src/person-full-name.ts";
import type { NameMention } from "../packages/chaff/src/name-variants.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// 空白を挟んで書いた姓と名（田中 裕子）を、名前まるごとで比べる（name-variant）。例文はすべて自作。

const variants = (source: string): readonly string[] => namedRuleRun("name-variant", source, ja, "a.md").findings;

const token = (surface: string, start: number, pos = "PROPN", nameType?: string): Token => ({
  surface,
  span: { start, end: start + surface.length },
  pos,
  ...(nameType === undefined ? {} : { features: { NameType: nameType } }),
});

const mention = (surface: string, offset: number, reading?: string): NameMention => ({ surface, offset, reading, words: [surface], person: true });

describe("name-variant: 空白を挟んだ姓と名", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("姓の違う二人の、読みの同じ名は言わない（田中 裕子 と 鈴木 祐子）", () => {
    assert.deepEqual(variants("田中 裕子が説明した。田中 裕子が答えた。鈴木 祐子が述べた。\n"), []);
    assert.deepEqual(variants("田中　裕子が説明した。田中　裕子が答えた。鈴木　祐子が述べた。\n"), []);
    assert.deepEqual(variants("田中 真一が説明した。田中 真一が答えた。鈴木 慎一が述べた。\n"), []);
  });

  it("空白なしで書いても言わない（田中裕子 と 鈴木祐子）", () => {
    assert.deepEqual(variants("田中裕子が説明した。田中裕子が答えた。鈴木祐子が述べた。\n"), []);
  });

  it("同じ姓で、名の読みが同じなら言う（中村 裕子 と 中村 祐子）", () => {
    assert.deepEqual(variants("中村 裕子が説明した。中村 裕子が答えた。中村 祐子が述べた。\n"), [
      "「中村 祐子」は、ほかの所では同じ読みの「中村 裕子」と書いています",
    ]);
    assert.deepEqual(variants("中村　裕子が説明した。中村　裕子が答えた。中村　祐子が述べた。\n"), [
      "「中村 祐子」は、ほかの所では同じ読みの「中村 裕子」と書いています",
    ]);
  });

  it("姓を字体の違う字で書いた同じ人は言う（斎藤 裕子 と 斉藤 裕子）", () => {
    assert.deepEqual(variants("斎藤 裕子が説明した。斎藤 裕子が答えた。斉藤 裕子が述べた。\n"), [
      "「斉藤 裕子」は、ほかの所では同じ読みの「斎藤 裕子」と書いています",
    ]);
  });

  it("同じ姓の二人と、読みの違う名は言わない（田中 健太 と 田中 健二、田中 裕子 と 田中 真一）", () => {
    assert.deepEqual(variants("田中 健太が説明した。田中 健太が答えた。田中 健二が述べた。\n"), []);
    assert.deepEqual(variants("田中 裕子が説明した。田中 真一が答えた。田中 裕子が述べた。\n"), []);
  });

  it("姓と名のあいだの空白だけの違いは言わない（田中 裕子 と 田中裕子）", () => {
    assert.deepEqual(variants("田中 裕子が説明した。田中 裕子が答えた。田中裕子が述べた。\n"), []);
  });

  it("名だけで書いた名は、名だけで書いた名と比べる", () => {
    assert.deepEqual(variants("裕子さんが説明した。裕子さんが答えた。祐子さんが述べた。\n"), ["「祐子」は、ほかの所では同じ読みの「裕子」と書いています"]);
    assert.deepEqual(variants("田中 裕子さんが説明した。鈴木 祐子さんが答えた。祐子さんが述べた。\n"), []);
  });
});

describe("person-full-name: 姓と名を一つの現れにする", () => {
  it("fullNameGaps: 姓（Sur）と名（Giv）のあいだの、半角か全角の空白一つ", () => {
    assert.deepEqual(fullNameGaps([token("田中", 0, "PROPN", "Sur"), token(" ", 2, "PUNCT"), token("裕子", 3, "PROPN", "Giv")]), [{ start: 2, end: 3 }]);
    assert.deepEqual(fullNameGaps([token("田中", 0, "PROPN", "Sur"), token("\u3000", 2, "PUNCT"), token("裕子", 3, "PROPN", "Giv")]), [{ start: 2, end: 3 }]);
  });

  it("fullNameGaps: 姓どうし（並べた出席者）、名と姓、空白でない記号、二つの空白、品詞の違う語は分けない", () => {
    assert.deepEqual(fullNameGaps([token("田中", 0, "PROPN", "Sur"), token(" ", 2, "PUNCT"), token("鈴木", 3, "PROPN", "Sur")]), []);
    assert.deepEqual(fullNameGaps([token("裕子", 0, "PROPN", "Giv"), token(" ", 2, "PUNCT"), token("田中", 3, "PROPN", "Sur")]), []);
    assert.deepEqual(fullNameGaps([token("田中", 0, "PROPN", "Sur"), token("、", 2, "PUNCT"), token("裕子", 3, "PROPN", "Giv")]), []);
    assert.deepEqual(fullNameGaps([token("田中", 0, "PROPN", "Sur"), token("  ", 2, "PUNCT"), token("裕子", 4, "PROPN", "Giv")]), []);
    assert.deepEqual(fullNameGaps([token("田中", 0, "NOUN", "Sur"), token(" ", 2, "PUNCT"), token("裕子", 3, "PROPN", "Giv")]), []);
    assert.deepEqual(fullNameGaps([token(" ", 0, "PUNCT"), token("裕子", 1, "PROPN", "Giv")]), []);
    assert.deepEqual(fullNameGaps([token("田中", 0, "PROPN", "Sur"), token(" ", 2, "PUNCT")]), []);
    assert.deepEqual(fullNameGaps([]), []);
  });

  it("joinFullNames: 空白をちょうど挟む姓と名を合わせ、読みと語をつなぐ", () => {
    const joined = joinFullNames([mention("裕子", 3, "ユウコ"), mention("田中", 0, "タナカ")], [{ start: 2, end: 3 }]);
    assert.deepEqual(joined, [{ surface: "田中 裕子", offset: 0, reading: "タナカユウコ", words: ["田中", "裕子"], person: true }]);
  });

  it("joinFullNames: 読めない語があれば読みは無く、名前らしさは強いほう", () => {
    const [joined] = joinFullNames(
      [
        { ...mention("田中", 0), cue: "slot" },
        { ...mention("裕子", 3, "ユウコ"), cue: "person" },
      ],
      [{ start: 2, end: 3 }],
    );
    assert.equal(joined?.reading, undefined);
    assert.equal(joined?.cue, "person");
  });

  it("joinFullNames: 解析器が二語に切った名も合わせる", () => {
    const [joined] = joinFullNames([mention("中村", 0, "ナカムラ"), { ...mention("健汰", 3), words: ["健", "汰"] }], [{ start: 2, end: 3 }]);
    assert.equal(joined?.surface, "中村 健汰");
    assert.deepEqual(joined?.words, ["中村", "健", "汰"]);
  });

  it("joinFullNames: 空白の位置が合わない、二語の姓、三つ続く名前は合わせない", () => {
    const gap = [{ start: 2, end: 3 }];
    assert.deepEqual(
      joinFullNames([mention("田中", 0), mention("裕子", 4)], gap).map((name) => name.surface),
      ["田中", "裕子"],
    );
    assert.deepEqual(
      joinFullNames([{ ...mention("田中", 0), words: ["田", "中"] }, mention("裕子", 3)], gap).map((name) => name.surface),
      ["田中", "裕子"],
    );
    assert.deepEqual(
      joinFullNames([mention("田中", 0), mention("裕子", 3), mention("健太", 6)], [...gap, { start: 5, end: 6 }]).map((name) => name.surface),
      ["田中 裕子", "健太"],
    );
    assert.deepEqual(joinFullNames([], gap), []);
    assert.deepEqual(
      joinFullNames([mention("田中", 0)], []).map((name) => name.surface),
      ["田中"],
    );
  });

  it("spacedOnly: 日本語の名前の、空白だけが違う形", () => {
    assert.equal(spacedOnly("田中 裕子", "田中裕子"), true);
    assert.equal(spacedOnly("田中裕子", "田中 裕子"), true);
    assert.equal(spacedOnly("田中 裕子", "田中 裕子"), false);
    assert.equal(spacedOnly("田中 裕子", "田中 祐子"), false);
    assert.equal(spacedOnly("田中 裕子", "田中・裕子"), false);
    assert.equal(spacedOnly("Mac OS", "MacOS"), false);
    assert.equal(spacedOnly("", ""), false);
  });
});
