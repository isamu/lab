import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { compoundSlipsIn, fallenWord, singleDifference, type CompoundUse } from "../packages/chaff/src/kanji-compound-slip.ts";

// 長い漢字の語の一字違い（kanji-compound-slip）。例文はすべて自作。

const RULE = "kanji-compound-slip";

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", genre).findings;

const USUAL = "就職氷河期世代";
const SLIP = "就職永河期世代";
const times = (sentence: string, count: number): string => Array.from({ length: count }, () => sentence).join("");
const USUAL_LINE = `${USUAL}の方を対象に選考を行います。`;
const SLIP_LINE = `${SLIP}の方の説明会も開きます。`;
const SLIP_SHORT = `${SLIP}の説明会です。`;
const lines = (...parts: readonly string[]): string => `${parts.join("")}\n`;

describe("kanji-compound-slip: 一字違いを指す", () => {
  it("三回書いた語の一字違いを一回", () => {
    const source = lines(times(USUAL_LINE, 3), SLIP_LINE);
    assert.deepEqual(findingsOf(source), [`「${SLIP}」と書いています（この文書は「${USUAL}」を 3 回書いています）`]);
  });

  it("二回写した一字違い（いつもの形が倍より多いとき）", () => {
    const source = lines(times(USUAL_LINE, 5), "\n\n- ", SLIP, "の説明会（本文）\n- ", SLIP, "の説明会（概要）");
    assert.equal(findingsOf(source).length, 2);
  });

  it("見出しに書いた語も数える", () => {
    const source = lines("## ", USUAL, "の採用\n\n", times(USUAL_LINE, 2), SLIP_LINE);
    assert.equal(findingsOf(source).length, 1);
  });

  it("見出しの一字違いは見出しの行を指す", () => {
    const source = lines("# 案内\n\n## ", SLIP, "の採用\n\n", times(USUAL_LINE, 3));
    const result = runRules(buildDocument("a.md", source, ja), loadRules("ja"), { [RULE]: "normal" }, false, "business/report");
    assert.deepEqual(
      result.findings.filter((finding) => finding.rule === RULE).map((finding) => finding.line),
      [3],
    );
  });

  it("どのジャンルでも動く", () => {
    const source = lines(times(USUAL_LINE, 3), SLIP_LINE);
    assert.ok(firedRules(ja, source, "blog/tech").includes(RULE));
    assert.ok(firedRules(ja, source, "legal/contract").includes(RULE));
  });
});

describe("kanji-compound-slip: 書き分けた語は指さない", () => {
  it("文書がほかの所で書いた語（質権）と、解析器が語として読む語（関係会社と関連会社）", () => {
    assert.deepEqual(findingsOf(`${times("当該債権者保護の手続を行う。", 3)}当該質権者保護の手続を行う。質権の設定も行う。\n`), []);
    assert.deepEqual(findingsOf(`${times("主要関連会社の一覧を示す。", 3)}主要関係会社の一覧を示す。\n`), []);
  });

  it("数・順・番地・期間の字（第一条と第二条、前年度と今年度、五日以内と五年以内）", () => {
    assert.deepEqual(findingsOf(`${times("同法第一条第一項に定める。", 3)}同法第二条第一項に定める。\n`), []);
    assert.deepEqual(findingsOf(`${times("全社前年度売上を示す。", 3)}全社今年度売上を示す。\n`), []);
    assert.deepEqual(findingsOf(`${times("請求後五日以内に支払う。", 3)}請求後五年以内に支払う。\n`), []);
  });

  it("漢字の続きの頭と終わりの字（資本金等と資本金及び）", () => {
    assert.deepEqual(findingsOf(`${times("資本金及び準備金の額を示す。", 3)}資本金等の額を示す。\n`), []);
  });

  it("いつもの形が三回に足りない・倍より多くない・違う形が三回ある", () => {
    assert.deepEqual(findingsOf(lines(times(USUAL_LINE, 2), SLIP_LINE)), []);
    assert.deepEqual(findingsOf(lines(times(USUAL_LINE, 4), times(SLIP_SHORT, 2))), []);
    assert.deepEqual(findingsOf(lines(times(USUAL_LINE, 7), times(SLIP_SHORT, 3))), []);
  });

  it("三字の語は比べない", () => {
    assert.deepEqual(findingsOf(`${times("氷河期の話をする。", 3)}永河期の話をする。\n`), []);
  });
});

describe("kanji-compound-slip: 比べ方（純粋な関数）", () => {
  const word = (start: number, end: number, known = true): { start: number; end: number; known: boolean } => ({ start, end, known });
  const usual = (offset: number): CompoundUse => ({ compound: "ABCDE", offset, words: [word(0, 2), word(2, 4), word(4, 5)] });

  it("一字だけ違う位置", () => {
    assert.equal(singleDifference(Array.from("ABCD"), Array.from("ABXD")), 2);
    assert.equal(singleDifference(Array.from("ABCD"), Array.from("AXXD")), undefined);
    assert.equal(singleDifference(Array.from("ABCD"), Array.from("ABCD")), undefined);
    assert.equal(singleDifference(Array.from("ABCD"), Array.from("ABCDE")), undefined);
  });

  it("違う字のところで語がばらばらになるか、読めない語になるときだけ", () => {
    const apart: CompoundUse = { compound: "ABXDE", offset: 9, words: [word(0, 2), word(2, 3), word(3, 4), word(4, 5)] };
    const unknown: CompoundUse = { compound: "ABXDE", offset: 9, words: [word(0, 2), word(2, 4, false), word(4, 5)] };
    const aWord: CompoundUse = { compound: "ABXDE", offset: 9, words: [word(0, 2), word(2, 4), word(4, 5)] };
    const spills: CompoundUse = { compound: "ABXDE", offset: 9, words: [word(0, 2), word(2, 3), word(3, 5)] };
    const unanalysed: CompoundUse = { compound: "ABXDE", offset: 9 };
    const crossing: CompoundUse = { compound: "ABXDE", offset: 9, words: [word(0, 2), { ...word(2, 3), crossesRun: true }, word(3, 4), word(4, 5)] };
    assert.equal(fallenWord(crossing, [usual(0)], 2), undefined);
    assert.equal(fallenWord(apart, [usual(0)], 2), "XD");
    assert.equal(fallenWord(unknown, [usual(0)], 2), "XD");
    assert.equal(fallenWord(aWord, [usual(0)], 2), undefined);
    assert.equal(fallenWord(spills, [usual(0)], 2), undefined);
    assert.equal(fallenWord(unanalysed, [usual(0)], 2), undefined);
    assert.equal(fallenWord(apart, [{ compound: "ABCDE", offset: 0 }], 2), undefined);
  });

  it("指すのは違う形の位置、比べるのはいつもの形", () => {
    const slip: CompoundUse = { compound: "ABXDE", offset: 9, words: [word(0, 2), word(2, 3), word(3, 4), word(4, 5)] };
    assert.deepEqual(compoundSlipsIn([usual(0), usual(1), usual(2), slip], new Set()), [
      { written: "ABXDE", usual: "ABCDE", usualCount: 3, offset: 9, index: 2 },
    ]);
    assert.deepEqual(compoundSlipsIn([usual(0), usual(1), usual(2), slip], new Set(["X"])), []);
    assert.deepEqual(compoundSlipsIn([usual(0), usual(1), usual(2), slip, { compound: "XDF", offset: 20 }], new Set()), []);
    assert.deepEqual(compoundSlipsIn([usual(0), usual(1), slip], new Set()), []);
    assert.deepEqual(compoundSlipsIn([], new Set()), []);
  });
});
