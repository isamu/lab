import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// dangling-reference in a paper whose sections are headed by bare numbers ("## 2 Methods") and which discusses the
// articles of a law it names. Every example is self-written.

const labelsOf = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), loadRules(en.id), {}, false, "academic/paper")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

const paper = (extra: string): string =>
  [
    "# Oversight of agents",
    "",
    "## 1 Introduction",
    "",
    "Article 14 of the Safety Act asks for human oversight. Section 2 sets out the method and Section 3 the results.",
    "",
    "## 2 Method",
    "",
    `We read Article 14(4) and Article 26 closely. ${extra}`,
    "",
    "## 3 Results",
    "",
    "Article 25 moves duties along the chain, as Section 1 noted.",
    "",
  ].join("\n");

describe("dangling-reference: a paper with bare-numbered sections", () => {
  it("does not look up the articles of the law it names", () => {
    assert.deepEqual(labelsOf(paper("")), []);
  });

  it("still reports a section of its own that does not exist", () => {
    assert.deepEqual(labelsOf(paper("Section 5 gives the proof.")), ["Section 5"]);
  });

  it("still reports an article when no other document's articles are named", () => {
    const own = paper("").replace("Article 14 of the Safety Act asks", "Oversight asks");
    assert.ok(labelsOf(own).includes("Article 14(4)"));
  });

  it("still reports an article when its references mostly resolve here", () => {
    const resolving = paper("").replace("We read Article 14(4) and Article 26 closely.", "Article 1, Article 2 and Article 3 hold; Article 9 is new.");
    const labels = labelsOf(resolving.replace("Article 25 moves", "Article 3 moves"));
    assert.deepEqual(labels, ["Article 9"]);
  });
});
