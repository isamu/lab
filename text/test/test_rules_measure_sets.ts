import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { documentSets, setOf } from "../scripts/rules-measure-sets.ts";

describe("documentSets: the documents yarn rules:measure runs together", () => {
  it("groups by set in the order sets first appear, keeping each set's order", () => {
    const members = [
      { set: "en a", id: 1 },
      { set: "ja b", id: 2 },
      { set: "en a", id: 3 },
      { set: "en c", id: 4 },
    ];
    assert.deepEqual(
      documentSets(members).map((set) => set.map((member) => member.id)),
      [[1, 3], [2], [4]],
    );
  });

  it("a member alone is a set of one, and nothing gives no sets", () => {
    assert.deepEqual(documentSets([{ set: "x" }]), [[{ set: "x" }]]);
    assert.deepEqual(documentSets([]), []);
  });
});

describe("setOf: a document's publisher, or its folder", () => {
  it("the language and the host of the URL", () => {
    assert.equal(setOf("en", "https://www.example.gov/a/b.html", "docs"), "en www.example.gov");
    assert.equal(setOf("ja", "https://www.example.gov/c", "docs"), "ja www.example.gov");
  });

  it("the folder when there is no URL or it cannot be read", () => {
    assert.equal(setOf("ja", undefined, "laws"), "ja laws");
    assert.equal(setOf("en", "not a url", "docs"), "en docs");
    assert.equal(setOf("en", "", "docs"), "en docs");
  });
});
