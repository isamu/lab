import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isFlattenedTable } from "../packages/chaff/src/detectors/sentence-parts.ts";

// no-doubled-joshi and a table a converter flattened into one sentence. Every example is self-written.

const countFor = (source: string): number => firedRules(ja, source).filter((id) => id === "no-doubled-joshi").length;

/** A header row whose cells run together: the の of 役員の兼任等, 営業上の取引 and 設備の賃貸借 are in three cells. */
const HEADER_ROW =
  "名称住所資本金(百万円)主要な事業の内容関係内容役員の兼任等資金援助営業上の取引設備の賃貸借所有割合(％)被所有割合(％)当社役員(人)東西商事株式会社東京都港区50物流事業100―02なし\n";

describe("no-doubled-joshi: a flattened table", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: the の of different header cells are not one run", () => {
    assert.equal(countFor(HEADER_ROW), 0);
  });

  it("invalid: a sentence naming a unit or two is still prose", () => {
    assert.equal(countFor("比率(％)と人数(人)は本社の営業部の第二課の方針で決めました。\n"), 1);
  });

  it("invalid: a run in the next sentence is still reported", () => {
    assert.equal(countFor(`${HEADER_ROW}\n本社の営業部の第二課の方針を確認しました。\n`), 1);
  });
});

describe("isFlattenedTable", () => {
  it("a header row of three cells closed by units, or glued numbers", () => {
    ["所有割合(％)被所有割合(％)当社役員(人)", "従業員数（人）平均年齢（歳）平均年間給与（千円）合計（千円）", "売上高8,45795.7合計307,81499.6"].forEach(
      (text) => assert.equal(isFlattenedTable(text), true, text),
    );
  });

  it("a sentence with fewer unit headers, or none", () => {
    ["比率(％)と人数(人)を決めました。", "本社の営業部の第二課の方針を確認しました。", "前期比は12.5％増の1,200円でした。"].forEach((text) =>
      assert.equal(isFlattenedTable(text), false, text),
    );
  });
});
