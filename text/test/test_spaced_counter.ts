import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { markSpacedCounters, type CounterReading } from "../packages/lang-ja/src/spaced-counter.ts";
import { readsAsCounter } from "../packages/lang-ja/src/pos.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// 数と空白 1 つを挟んだ助数詞（10 回、3 日）を、詰めて書いたときと同じ助数詞として読む。

const token = (start: number, surface: string, pos: string, features?: Record<string, string>): Token => ({
  span: { start, end: start + surface.length },
  surface,
  pos,
  ...(features === undefined ? {} : { features }),
});

const CARD = { NumType: "Card" };

/** 読み直しの代わり。回・日だけを助数詞と答える。 */
const counters: CounterReading = (_number, word) => ["回", "日"].includes(word);

const shape = (tokens: readonly Token[]): string[] =>
  tokens.map((item) => `${item.surface}/${item.pos}${item.features === undefined ? "" : JSON.stringify(item.features)}`);

describe("markSpacedCounters", () => {
  it("re-reads a counter after a number and one space, dropping the place-name reading", () => {
    const tokens = [token(0, "10", "NOUN", CARD), token(2, " ", "PUNCT"), token(3, "日", "PROPN", { NameType: "Geo" }), token(4, "で", "ADP")];
    assert.deepEqual(shape(markSpacedCounters(tokens, counters)), [
      "10/NOUN" + JSON.stringify(CARD),
      " /PUNCT",
      '日/NOUN{"NounType":"Class","Bound":"Yes"}',
      "で/ADP",
    ]);
  });

  it("keeps the lemma of the re-read word", () => {
    const tokens = [token(0, "3", "NOUN", CARD), token(1, " ", "PUNCT"), { ...token(2, "回", "NOUN"), lemma: "回" }];
    assert.equal(markSpacedCounters(tokens, counters)[2]?.lemma, "回");
  });

  it("leaves a word that does not read as a counter, and a word already read as one", () => {
    const title = [token(0, "29", "NOUN", CARD), token(2, " ", "PUNCT"), token(3, "総務", "NOUN")];
    assert.deepEqual(markSpacedCounters(title, counters), title);
    const already = [token(0, "3", "NOUN", CARD), token(1, " ", "PUNCT"), token(2, "件", "NOUN", { NounType: "Class" })];
    assert.deepEqual(
      markSpacedCounters(already, () => false),
      already,
    );
  });

  it("looks only at one space right after a number", () => {
    const touching = [token(0, "3", "NOUN", CARD), token(1, "回", "NOUN")];
    assert.deepEqual(markSpacedCounters(touching, counters), touching);
    const notNumber = [token(0, "毎", "NOUN"), token(1, " ", "PUNCT"), token(2, "回", "NOUN")];
    assert.deepEqual(markSpacedCounters(notNumber, counters), notNumber);
    const twoSpaces = [token(0, "3", "NOUN", CARD), token(1, "  ", "PUNCT"), token(3, "回", "NOUN")];
    assert.deepEqual(markSpacedCounters(twoSpaces, counters), twoSpaces);
    const comma = [token(0, "3", "NOUN", CARD), token(1, "、", "PUNCT"), token(2, "回", "NOUN")];
    assert.deepEqual(markSpacedCounters(comma, counters), comma);
    const gapped = [token(0, "3", "NOUN", CARD), token(2, " ", "PUNCT"), token(3, "回", "NOUN")];
    assert.deepEqual(markSpacedCounters(gapped, counters), gapped);
  });

  it("keeps a numeral after the space as a numeral (万 in 26.7 万)", () => {
    const tokens = [token(0, "7", "NOUN", CARD), token(1, " ", "PUNCT"), token(2, "万", "NOUN", CARD)];
    assert.deepEqual(
      markSpacedCounters(tokens, () => true),
      tokens,
    );
  });

  it("returns nothing for nothing", () => {
    assert.deepEqual(markSpacedCounters([], counters), []);
  });
});

describe("readsAsCounter", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("reads 回, 日, 件, 人 after a number as counters", () => {
    ["回", "日", "件", "人"].forEach((word) => assert.equal(readsAsCounter("10", word), true, word));
  });

  it("reads a word that starts with 万 or 億 after a number as attached to it", () => {
    assert.equal(readsAsCounter("26.7", "万行"), true);
    assert.equal(readsAsCounter("3", "億円"), true);
  });

  it("does not read a title or a word the analyser splits differently as a counter", () => {
    ["総務省", "背景", "ファックス", "文字", "日本", "件名"].forEach((word) => assert.equal(readsAsCounter("10", word), false, word));
  });

  it("gives the adapter's tokens the counter after a spaced number", () => {
    const sentence = ja.segment("10 回で止める。").sentences[0];
    const counter = sentence?.tokens?.find((item) => item.surface === "回");
    assert.equal(counter?.features?.["NounType"], "Class");
  });
});
