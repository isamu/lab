import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { joinedBlanks } from "../packages/chaff/src/detectors/blank-runs.ts";

// One blank is reported once: pieces that only blank marks, spaces and hyphens separate are one blank.

const at = (text: string, piece: string, from = 0) => {
  const start = text.indexOf(piece, from);
  return { start, end: start + piece.length };
};
const quoted = (text: string, spans: readonly { start: number; end: number }[]) => joinedBlanks(text, spans).map((span) => text.slice(span.start, span.end));

describe("joinedBlanks", () => {
  it("joins pieces a hyphen, a space or more marks separate", () => {
    const text = "03-〇〇〇〇-〇〇〇〇";
    assert.deepEqual(quoted(text, [at(text, "〇〇〇〇"), at(text, "〇〇〇〇", 8)]), ["〇〇〇〇-〇〇〇〇"]);
    const address = "〇〇区〇〇 〇丁目〇番";
    assert.deepEqual(quoted(address, [at(address, "〇丁目"), at(address, "〇〇区"), at(address, "〇番")]), ["〇〇区〇〇 〇丁目〇番"]);
  });

  it("joins overlapping and contained pieces", () => {
    const text = "〇〇〇〇ビル";
    assert.deepEqual(
      quoted(text, [
        { start: 0, end: 6 },
        { start: 2, end: 4 },
      ]),
      ["〇〇〇〇ビル"],
    );
    assert.deepEqual(
      quoted(text, [
        { start: 0, end: 3 },
        { start: 2, end: 6 },
      ]),
      ["〇〇〇〇ビル"],
    );
  });

  it("keeps pieces apart when a filled word or a line break separates them", () => {
    const text = "株式会社〇〇の〇〇様";
    assert.deepEqual(quoted(text, [at(text, "〇〇"), at(text, "〇〇様")]), ["〇〇", "〇〇様"]);
    const lines = "〇〇\n〇〇";
    assert.deepEqual(
      quoted(lines, [
        { start: 0, end: 2 },
        { start: 3, end: 5 },
      ]),
      ["〇〇", "〇〇"],
    );
  });

  it("takes in the marks right beside a blank, and stops at a filled word or a line break", () => {
    const place = "東京都〇〇区〇〇 にあります";
    assert.deepEqual(quoted(place, [at(place, "〇〇区")]), ["〇〇区〇〇"]);
    const street = "本町〇丁目〇-〇";
    assert.deepEqual(quoted(street, [at(street, "〇丁目")]), ["〇丁目〇-〇"]);
    const name = "〇〇 〇〇様";
    assert.deepEqual(quoted(name, [at(name, "〇〇様")]), ["〇〇 〇〇様"]);
    const trailing = "〇〇様 - 以上";
    assert.deepEqual(quoted(trailing, [at(trailing, "〇〇様")]), ["〇〇様"]);
    const lines = "〇〇\n〇〇様";
    assert.deepEqual(quoted(lines, [at(lines, "〇〇様")]), ["〇〇様"]);
  });

  it("returns nothing for nothing, and one span as it is", () => {
    assert.deepEqual(joinedBlanks("abc", []), []);
    assert.deepEqual(joinedBlanks("〇〇", [{ start: 0, end: 2 }]), [{ start: 0, end: 2 }]);
  });
});
