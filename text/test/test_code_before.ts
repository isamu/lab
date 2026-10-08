import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { followsInlineCode } from "../packages/chaff/src/detectors/code-before.ts";

// Inline code right before a place in the text. prose is the source with the code masked. Every example is self-written.

/** The source with each `code` span blanked, as the document reader masks it. */
const masked = (source: string): string => source.replace(/`[^`\n]*`/gu, (code) => " ".repeat(code.length));
const follows = (source: string, offset: number): boolean => followsInlineCode(source, masked(source), offset);

describe("followsInlineCode", () => {
  it("is true past spaces and tabs after code's closing mark", () => {
    const source = "`explain` でも";
    assert.equal(follows(source, source.indexOf("でも")), true);
    assert.equal(follows("a `x`\tより", "a `x`\t".length), true);
    assert.equal(follows("`x`より", 3), true);
  });

  it("is false after a word, a full stop, a line break, at the start, or without masked prose", () => {
    assert.equal(follows("文章が より", "文章が ".length), false);
    assert.equal(follows("`x` を使う。でも", "`x` を使う。".length), false);
    assert.equal(follows("`x`\nでも", "`x`\n".length), false);
    assert.equal(follows("でも", 0), false);
    assert.equal(follows("", 0), false);
    assert.equal(followsInlineCode("`x` でも", undefined, 4), false);
  });

  it("is false after a backtick the prose keeps: escaped or never closed", () => {
    assert.equal(followsInlineCode("\\` さらに", "\\` さらに", 3), false);
  });
});
