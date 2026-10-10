import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { teaserOf } from "../site/src/lib/ruleTeaser.ts";

describe("rule list: the example line under each rule", () => {
  it("shows the first thing chaff printed on the example", () => {
    const output = [
      { line: 4, column: 3, message: "The total $9,000 is not the sum of its items ($8,000)" },
      { line: 6, column: 1, message: "second finding" },
    ];
    assert.deepEqual(teaserOf(output, { before: "| Total | $9,000 |\n" }), {
      kind: "message",
      text: "The total $9,000 is not the sum of its items ($8,000)",
    });
  });

  it("with nothing printed (a check an AI reads), shows the example's first line of prose, past headings and blank lines", () => {
    const before = "## Summary\n\n  This article showed how to speed up the build.  \nIt matters.\n";
    assert.deepEqual(teaserOf([], { before }), { kind: "excerpt", text: "This article showed how to speed up the build." });
  });

  it("with nothing printed and no prose, gives an empty excerpt rather than throwing", () => {
    assert.deepEqual(teaserOf([], { before: "" }), { kind: "excerpt", text: "" });
    assert.deepEqual(teaserOf([], { before: "# Only a heading\n\n\n" }), { kind: "excerpt", text: "" });
  });

  it("keeps a message as printed, even an empty one", () => {
    assert.deepEqual(teaserOf([{ line: 1, column: 1, message: "" }], { before: "text" }), { kind: "message", text: "" });
  });
});
