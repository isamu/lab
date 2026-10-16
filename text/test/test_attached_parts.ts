import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { attachedPartStarts, partAt } from "../packages/chaff/src/structure/attached-parts.ts";

// An instrument attached to an agreement (Exhibit A, a restated charter) is a separate document: duplicate-definition
// compares its definitions only with each other. Self-written text.

const duplicates = (source: string): readonly string[] => namedRuleRun("duplicate-definition", source, en).findings;

const AGREEMENT = ["Merger Agreement", "", 'The law of the State of Delaware ("Delaware Law") governs this Agreement.', ""];

describe("duplicate-definition: an attached instrument", () => {
  it("does not report a definition inside an attached exhibit that the agreement also makes", () => {
    const source = [...AGREEMENT, "Exhibit A to Merger Agreement", "", 'FIRST: The corporation is governed by the law of Delaware ("Delaware Law").', ""];
    assert.deepEqual(duplicates(source.join("\n")), []);
    const heading = [...AGREEMENT, "## EXHIBIT A", "", 'FIRST: The corporation is governed by the law of Delaware ("Delaware Law").', ""];
    assert.deepEqual(duplicates(heading.join("\n")), []);
  });

  it("still reports a term defined twice in the agreement, or twice in the exhibit", () => {
    const body = [
      ...AGREEMENT,
      'Any dispute is heard under the law of Delaware ("Delaware Law").',
      "",
      "Exhibit A to Merger Agreement",
      "",
      "FIRST: The name is Example Corp.",
      "",
    ];
    assert.deepEqual(duplicates(body.join("\n")), ['"Delaware Law" is also defined on line 3']);
    const exhibit = [
      ...AGREEMENT,
      "Exhibit A",
      "",
      'FIRST: Example Corp. (the "Corporation") is formed.',
      "",
      'SECOND: Example Corp. (the "Corporation") lives on.',
      "",
    ];
    assert.deepEqual(duplicates(exhibit.join("\n")), ['"Corporation" is also defined on line 7']);
  });

  it("does not read a sentence or a line inside a paragraph as an exhibit's title", () => {
    const sentence = [
      ...AGREEMENT,
      "Exhibit A sets out the charter of the surviving corporation.",
      "",
      'The charter applies the law of Delaware ("Delaware Law").',
      "",
    ];
    assert.deepEqual(duplicates(sentence.join("\n")), ['"Delaware Law" is also defined on line 3']);
  });

  it("attachedPartStarts: a label, its letter or number and a short title, alone between blank lines", () => {
    const labels = ["Exhibit", "Annex"];
    assert.deepEqual(attachedPartStarts("a\n\nExhibit A to Merger Agreement\n\nb", labels), [3]);
    assert.deepEqual(attachedPartStarts("Annex 1\n\nb", labels), [0]);
    assert.deepEqual(attachedPartStarts("a\n\n### Exhibit B-2\n\nb", labels), [3]);
    assert.deepEqual(attachedPartStarts("a\r\n\r\nExhibit A\r\n\r\nb", labels), [5]);
    assert.deepEqual(attachedPartStarts("a\nExhibit A\n\nb", labels), []);
    assert.deepEqual(attachedPartStarts("a\n\nExhibit A lists the prices for the goods sold to the Buyer.\n\nb", labels), []);
    assert.deepEqual(attachedPartStarts("a\n\nExhibit a\n\nb", labels), []);
    assert.deepEqual(attachedPartStarts("a\n\nExhibits A\n\nb", labels), []);
    assert.deepEqual(attachedPartStarts("a\n\nExhibit A.\n\nb", labels), []);
    assert.deepEqual(attachedPartStarts("a\n\nExhibit 2.1\n\nb", labels), [3]);
    assert.deepEqual(attachedPartStarts("a\n\nExhibit A\n\nb", []), []);
  });

  it("partAt: 0 before the first attachment, then its number", () => {
    assert.equal(partAt([], 5), 0);
    assert.equal(partAt([10, 20], 5), 0);
    assert.equal(partAt([10, 20], 10), 1);
    assert.equal(partAt([10, 20], 25), 2);
  });
});
