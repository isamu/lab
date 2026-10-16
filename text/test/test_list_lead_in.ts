import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { itemMarkerSpan, listLeadIns, markerShape } from "../packages/chaff/src/structure/list-lead-in.ts";
import type { Sentence } from "../packages/chaff/src/plugin.ts";

// 箇条書きの項目の文の導入の文（listLeadIns）。例文はすべて自作。

/** 1 行を 1 文に読んだ文書。印で始まる行は項目の文。 */
const linesAsSentences = (source: string): Sentence[] =>
  [...source.matchAll(/[^\n]+/gu)].map((match) => ({
    span: { start: match.index, end: match.index + match[0].length },
    text: match[0],
    ...(/^\s*(?:\(|[①②③・]|\d\.)/u.test(match[0]) ? { listItem: true as const } : {}),
  }));

/** 項目の文ごとに、その文の頭と導入の文の頭（近い順）。 */
const leadInsOf = (source: string): string[] =>
  [...listLeadIns(source, linesAsSentences(source))].map(([item, leadIns]) =>
    [item.text.slice(0, 3), ...leadIns.map((leadIn) => leadIn.text.slice(0, 3))].join(" < "),
  );

describe("listLeadIns: 項目の文の導入の文", () => {
  it("items under different lead-ins take their own lead-in, and a later sibling takes the first item's", () => {
    const source = [
      "Section 7 Approval of the plan",
      "(1) If the Board rejects the plan—",
      "(a) the Manager must not publish the plan, and",
      "(b) the Manager must prepare another plan.",
      "(2) If the Board approves the plan—",
      "(a) the Manager must publish the plan, and",
      "(b) the plan takes effect after 21 days.",
      "(3) Nothing in this section stops a second plan.",
    ].join("\n");
    assert.deepEqual(leadInsOf(source), ["(1)", "(a) < (1)", "(b) < (1)", "(2)", "(a) < (2)", "(b) < (2)", "(3)"]);
  });

  it("a nested list carries its whole chain, and (i) after (h) is a letter, after (a) a roman numeral", () => {
    const source = [
      "(1) Where the Board meets—",
      "(a) if the Chair is present—",
      "(i) the Chair must open the meeting;",
      "(ii) the Secretary must keep the minutes;",
      "(b) the Board must decide by vote.",
      "(h) the Board must publish the minutes,",
      "(i) the Board must keep the minutes.",
    ].join("\n");
    assert.deepEqual(leadInsOf(source), ["(1)", "(a) < (1)", "(i) < (a) < (1)", "(ii < (a) < (1)", "(b) < (1)", "(h) < (1)", "(i) < (1)"]);
  });

  it("日本語の「：」で終わる導入と、空行で改まる段落", () => {
    const source = [
      "承認した場合：",
      "① 受託者は、報告書を公表しなければならない。",
      "② 受託者は、写しを保管する。",
      "",
      "① 受託者は、報告書を公表してはならない。",
    ].join("\n");
    assert.deepEqual(leadInsOf(source), ["① 受 < 承認し", "② 受 < 承認し", "① 受"]);
  });

  it("a line that ends without a colon or a dash is not a lead-in", () => {
    assert.deepEqual(leadInsOf("Section 5 Confidentiality\n(1) The Supplier must not disclose the data.\n(2) The Supplier must keep the data."), [
      "(1)",
      "(2)",
    ]);
    assert.deepEqual(leadInsOf("受託者は、次のとおりとする。\n・ 報告書を公表しなければならない。"), ["・ 報"]);
  });

  it("a sentence that is not an item has no lead-in", () => {
    assert.deepEqual(leadInsOf("The Supplier must:\nThe Supplier must not disclose the data."), []);
    assert.deepEqual(leadInsOf(""), []);
  });
});

describe("markerShape and itemMarkerSpan", () => {
  it("the shape of a marker leaves out the number", () => {
    const shapes = ["(3)", "(a)", "(ii)", "(B)", "①", "一　", "（イ）", "・", "1.", "１．"].map((text) => markerShape(text, new Map())?.shape);
    assert.deepEqual(shapes, ["(1)", "(a)", "(i)", "(A)", "①", "一", "（イ）", "・", "1.", "1．"]);
    assert.equal(markerShape("(i)", new Map([["(a)", "h"]]))?.shape, "(a)");
    assert.equal(markerShape("(i)", new Map([["(a)", "b"]]))?.shape, "(i)");
    assert.equal(markerShape("", new Map()), undefined);
  });

  it("the marker of an item sentence, and none for a sentence that is not an item", () => {
    const item: Sentence = { span: { start: 10, end: 40 }, text: "(a) the Manager must publish", listItem: true };
    assert.deepEqual(itemMarkerSpan(item), { start: 10, end: 13 });
    assert.equal(itemMarkerSpan({ span: item.span, text: item.text }), undefined);
  });
});
