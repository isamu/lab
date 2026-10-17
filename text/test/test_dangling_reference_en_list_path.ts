import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { hasListPath, listLabels } from "../packages/chaff/src/structure/written-list-path.ts";

// dangling-reference in English: a "#### 9." heading whose parts are list items "(b)", with nested items "i." indented
// by tabs, so "Section 9(b)(i)" names a list item rather than a label written in the text. All text is self-written.

const lines = (...rows: string[]): string => rows.join("\n");

const danglingLabels = (source: string): string[] =>
  runRules(buildDocument("charter.md", source, en), loadRules("en"), {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

describe("listLabels", () => {
  it("reads labels at the start of list items, with their indent", () => {
    const body = lines("-\t(a) Purpose: the board advises.", "", "\t-\ti. Hold meetings.", "\t\t-\ta. Monthly.", "  - 2) Report.");
    assert.deepEqual(listLabels(body), [
      { label: "a", indent: 0 },
      { label: "i", indent: 4 },
      { label: "a", indent: 8 },
      { label: "2", indent: 2 },
    ]);
  });
  it("does not read a label inside a line, a bare word, or an empty item", () => {
    assert.deepEqual(listLabels("The board (a) meets. See ii. below."), []);
    assert.deepEqual(listLabels("- Purpose of the board"), []);
    assert.deepEqual(listLabels("- (b)"), []);
    assert.deepEqual(listLabels("- (b. Members"), []);
    assert.deepEqual(listLabels(""), []);
  });
});

describe("hasListPath", () => {
  const items = listLabels(
    lines("-\t(a) Purpose.", "\t-\ti. Advise.", "\t-\tii. Report.", "-\t(b) Members.", "\t-\ti. One per member.", "\t\t-\ta. Elected.", "-\t(c) Terms."),
  );
  it("follows the labels down the nesting", () => {
    assert.equal(hasListPath(items, ["b", "i"]), true);
    assert.equal(hasListPath(items, ["a", "ii"]), true);
    assert.equal(hasListPath(items, ["b", "i", "a"]), true);
    assert.equal(hasListPath(items, ["c"]), true);
  });
  it("does not take a label from a sibling or a parent", () => {
    assert.equal(hasListPath(items, ["b", "ii"]), false);
    assert.equal(hasListPath(items, ["c", "i"]), false);
    assert.equal(hasListPath(items, ["i", "b"]), false);
    assert.equal(hasListPath(items, ["d"]), false);
  });
  it("does not start the path below the top of the list", () => {
    assert.equal(hasListPath(items, ["i"]), false);
    assert.equal(hasListPath(items, ["i", "a"]), false);
    const deeper = listLabels(lines("-\t(a) Purpose.", "\t-\t(b) Members.", "\t\t-\ti. One per member."));
    assert.equal(hasListPath(deeper, ["b", "i"]), false);
    assert.equal(hasListPath(deeper, ["a", "b", "i"]), true);
  });
  it("finds nothing with no labels or no items", () => {
    assert.equal(hasListPath(items, []), false);
    assert.equal(hasListPath([], ["a"]), false);
  });
});

describe("dangling-reference on a charter whose parts are nested list items", () => {
  const charter = (reference: string): string =>
    lines(
      "# Charter of the Example Society",
      "",
      "#### 1. Purpose.",
      "",
      `The Society promotes the hobby. A member may join a committee set up under ${reference}.`,
      "",
      "#### 2. Committees",
      "",
      "-\t(a) The Board may set up committees.",
      "",
      "-\t(b) Committees can be of the following kinds:",
      "",
      "\t-\ti. Standing committees, which meet every month",
      "",
      "\t\t-\ta. The committee keeps minutes.",
      "",
      "\t-\tii. Working groups, which end when their task is done",
      "",
      "-\t(c) Each committee reports to the Board.",
    );

  it("finds a part written as a nested list item", () => assert.deepEqual(danglingLabels(charter("Section 2(b)(i)")), []));
  it("finds a part two levels down", () => assert.deepEqual(danglingLabels(charter("Section 2(b)(i)(a)")), []));
  it("still reports a part the list does not have", () => assert.deepEqual(danglingLabels(charter("Section 2(b)(iv)")), ["Section 2(b)(iv)"]));
  it("still reports a part under the wrong parent", () => assert.deepEqual(danglingLabels(charter("Section 2(c)(i)")), ["Section 2(c)(i)"]));
  it("still reports a section the charter does not have", () => assert.deepEqual(danglingLabels(charter("Section 9(b)(i)")), ["Section 9(b)(i)"]));
});
