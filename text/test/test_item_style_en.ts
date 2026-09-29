import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { depthFor, ordinalOf, styleOf, styleOfOpen, type Style } from "../packages/lang-en/src/item-style.ts";
import type { NumberedLine, NumberingContext } from "../packages/chaff/src/plugin.ts";

const SECTION: NumberedLine = { kind: "article", depth: 1, number: "310.3", absolute: true, label: "Section 310.3", heading: "", rest: "" };

/** 項目を読んだときと同じ形で作る。並びの位置は、その書き方での位置。 */
const item = (raw: string, style: Style, depth: number): NumberedLine => ({
  kind: "item",
  depth,
  number: raw,
  absolute: false,
  label: `(${raw})`,
  heading: "",
  rest: "text",
  ordinal: ordinalOf(raw, style),
});

const context = (...open: NumberedLine[]): NumberingContext => ({ open, isHeading: false });

describe("lang-en: whether a single (i), (v) or (x) is a roman numeral or a letter", () => {
  it("is roman right under a numbered paragraph, as US regulations go (a)(1)(i)", () => {
    const open = context(SECTION, item("a", "letter", 2), item("1", "digit", 3));
    assert.equal(styleOf("i", open), "roman");
    assert.equal(styleOf("v", open), "roman");
    assert.equal(styleOf("x", open), "roman");
  });

  it("is roman right under a lettered item, and while a roman list is open", () => {
    assert.equal(styleOf("i", context(SECTION, item("a", "letter", 2))), "roman");
    assert.equal(styleOf("v", context(SECTION, item("a", "letter", 2), item("iv", "roman", 3))), "roman");
    assert.equal(styleOf("i", context(SECTION, item("a", "letter", 2), item("ii", "roman", 3), item("1", "digit", 4))), "roman");
  });

  it("is the letter i after an open (h), even with a numbered paragraph under it", () => {
    assert.equal(styleOf("i", context(SECTION, item("h", "letter", 2))), "letter");
    assert.equal(styleOf("i", context(SECTION, item("h", "letter", 2), item("1", "digit", 3))), "letter");
    assert.equal(styleOf("i", context(SECTION, item("1", "digit", 2), item("h", "letter", 3))), "letter");
    assert.equal(styleOf("v", context(SECTION, item("u", "letter", 2), item("2", "digit", 3))), "letter");
    assert.equal(styleOf("x", context(SECTION, item("w", "letter", 2))), "letter");
  });

  it("is a letter right under a heading or with nothing open, where nothing says it opens a level", () => {
    assert.equal(styleOf("i", context(SECTION)), "letter");
    assert.equal(styleOf("i", context()), "letter");
  });

  it("reads the unambiguous labels by their shape, whatever is open", () => {
    const open = context(SECTION, item("h", "letter", 2), item("1", "digit", 3));
    assert.equal(styleOf("ii", open), "roman");
    assert.equal(styleOf("ix", open), "roman");
    assert.equal(styleOf("b", open), "letter");
    assert.equal(styleOf("j", open), "letter");
    assert.equal(styleOf("2", open), "digit");
    assert.equal(styleOf("2A", open), "digit");
  });
});

describe("lang-en: how an open item was read", () => {
  it("a single (i), (v) or (x) keeps the reading it was opened with", () => {
    assert.equal(styleOfOpen(item("i", "roman", 3)), "roman");
    assert.equal(styleOfOpen(item("i", "letter", 3)), "letter");
    assert.equal(styleOfOpen(item("v", "roman", 3)), "roman");
    assert.equal(styleOfOpen(item("v", "letter", 3)), "letter");
    assert.equal(styleOfOpen(item("x", "roman", 3)), "roman");
    assert.equal(styleOfOpen(item("x", "letter", 3)), "letter");
  });

  it("an item without an ordinal, or not in parentheses, is not taken for roman", () => {
    assert.equal(styleOfOpen({ ...item("i", "roman", 3), ordinal: undefined }), "letter");
    assert.equal(styleOfOpen(SECTION), undefined);
    assert.equal(styleOfOpen({ ...item("1", "digit", 3), label: "1." }), undefined);
  });

  it("the other labels by their shape", () => {
    assert.equal(styleOfOpen(item("ii", "roman", 3)), "roman");
    assert.equal(styleOfOpen(item("b", "letter", 2)), "letter");
    assert.equal(styleOfOpen(item("aa", "letter", 2)), "letter");
    assert.equal(styleOfOpen(item("12", "digit", 2)), "digit");
    assert.equal(styleOfOpen(item("A1", "digit", 2)), "digit");
  });
});

describe("lang-en: how deep an item goes", () => {
  it("the letter (j) after a letter (i) under (1) is its sibling, not a level below", () => {
    const open = context(SECTION, item("1", "digit", 2), item("i", "letter", 3));
    assert.equal(depthFor(styleOf("j", open), open), 3);
  });

  it("a roman (ii) after a roman (i) under (1) is its sibling; a new level goes one deeper", () => {
    const open = context(SECTION, item("a", "letter", 2), item("1", "digit", 3), item("i", "roman", 4));
    assert.equal(depthFor(styleOf("ii", open), open), 4);
    assert.equal(depthFor(styleOf("2", open), open), 3);
    assert.equal(depthFor(styleOf("b", open), open), 2);
    assert.equal(depthFor("roman", context(SECTION, item("a", "letter", 2), item("1", "digit", 3))), 4);
  });
});
