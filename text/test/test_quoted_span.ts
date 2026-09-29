import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isWithinAny, quotedSpans } from "../packages/chaff/src/quoted-span.ts";

const contents = (text: string): string[] => quotedSpans(text).map((span) => text.slice(span.start, span.end));

describe("quotedSpans", () => {
  it("returns what is inside each pair of 「」 and 『』, without the brackets", () => {
    assert.deepEqual(contents("定めた「食品中のウイルス」において"), ["食品中のウイルス"]);
    assert.deepEqual(contents("『日本の文学』と「近代の歴史」"), ["日本の文学", "近代の歴史"]);
  });

  it("returns a nested pair and the pair around it", () => {
    assert.deepEqual(contents("「題は『日本の文学』です」"), ["日本の文学", "題は『日本の文学』です"]);
  });

  it("an empty pair has an empty span", () => {
    assert.deepEqual(quotedSpans("「」"), [{ start: 1, end: 1 }]);
  });

  it("makes no span from an unclosed bracket, a stray closer, or a closer of the other kind", () => {
    assert.deepEqual(contents("「弊社の計画"), []);
    assert.deepEqual(contents("弊社の計画」です"), []);
    assert.deepEqual(contents("「弊社の計画』です"), []);
    assert.deepEqual(contents(""), []);
    assert.deepEqual(contents("括弧の無い文"), []);
  });

  it("closes the innermost open bracket first, and an unclosed outer one stays open", () => {
    assert.deepEqual(contents("「前置き「題」の続き"), ["題"]);
  });

  it("counts positions in UTF-16 units, past a character outside the BMP", () => {
    const text = "𠮷「野の家」";
    assert.deepEqual(quotedSpans(text), [{ start: 3, end: 6 }]);
    assert.deepEqual(contents(text), ["野の家"]);
  });
});

describe("isWithinAny", () => {
  const spans = [{ start: 3, end: 6 }];

  it("is within when the inner span lies wholly inside one span, up to its edges", () => {
    assert.equal(isWithinAny(spans, { start: 3, end: 6 }), true);
    assert.equal(isWithinAny(spans, { start: 4, end: 5 }), true);
  });

  it("is not within when the inner span sticks out on either side, or there are no spans", () => {
    assert.equal(isWithinAny(spans, { start: 2, end: 4 }), false);
    assert.equal(isWithinAny(spans, { start: 5, end: 7 }), false);
    assert.equal(isWithinAny([], { start: 0, end: 0 }), false);
  });
});
