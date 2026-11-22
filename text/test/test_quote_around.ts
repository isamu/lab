import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quoteAround } from "../packages/chaff/src/detectors/quote-around.ts";

// The excerpt shown above a finding: the words around the place, which stay inside a table row. Texts self-written.

const at = (text: string, word: string): number => text.indexOf(word);

describe("quoteAround: a table row", () => {
  const table = [
    "| Item | Details |",
    "| --- | --- |",
    "| Days off | Two days off every week (Saturday and Sunday) and public holidays |",
    "| Annual days off | 98 days |",
    "| Annual leave | 10 days in the first year |",
    "",
  ].join("\n");

  it("stops at the end of the row, not in the next row", () => {
    assert.equal(quoteAround(table, at(table, "98 days")), "| Annual days off | 98 days |");
  });

  it("stops at the start of the row, not in the row above", () => {
    assert.equal(quoteAround(table, at(table, "10 days")), "| Annual leave | 10 days in the first");
  });

  it("a Japanese row", () => {
    const rows = "| 休日 | 完全週休2日制（土曜日・日曜日）、祝日 |\n| 年間休日 | 90日 |\n| 有給休暇 | 初年度10日 |\n";
    assert.equal(quoteAround(rows, at(rows, "90日")), "| 年間休日 | 90日 |");
  });

  it("a long row is still cut by the reach on both sides", () => {
    const row = "| Commission (5% of the sale price) | $15,600.00 |\n| Title insurance | $1,200.00 |\n";
    assert.equal(quoteAround(row, at(row, "$15,600.00")), "f the sale price) | $15,600.00 |");
  });

  it("prose next to a table does not run into the table", () => {
    const text = "The fees are below.\n| Item | Fee |\n";
    assert.equal(quoteAround(text, at(text, "below")), "The fees are below.");
    const after = "| Item | Fee |\nThe fees are above.\n";
    assert.equal(quoteAround(after, at(after, "above")), "The fees are above.");
  });
});

describe("quoteAround: prose", () => {
  it("lines of one paragraph are joined, as before", () => {
    const text = "The first line of a paragraph\ngoes on to the second line.\n";
    assert.equal(quoteAround(text, at(text, "goes")), "line of a paragraph goes on to the second");
  });

  it("the start and the end of the text", () => {
    assert.equal(quoteAround("Short.", 0), "Short.");
    assert.equal(quoteAround("Short.", 5), "Short.");
    assert.equal(quoteAround("", 0), "");
    assert.equal(quoteAround("\n| a | 1 |\n", 0), "");
    assert.equal(quoteAround("\n| a | 1 |\n", 3), "| a | 1 |");
  });

  it("a place spanning two rows keeps both", () => {
    const rows = "| a | 1 |\n| b | 2 |\n| c | 3 |\n";
    assert.equal(quoteAround(rows, at(rows, "1"), at(rows, "2") + 1), "| a | 1 | | b | 2 |");
  });
});
