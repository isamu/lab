import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isRunTogether } from "../packages/chaff/src/detectors/run-together.ts";

// undefined-term and a capitalised run that holds a word a conversion ran together (Space Includingspecified Description).
// Self-written text.

const termsIn = (source: string): string[] =>
  runRules(buildDocument("c.txt", source, en), loadRules("en"), {}, false, "legal/contract")
    .findings.filter((finding) => finding.rule === "undefined-term")
    .map((finding) => String(finding.values["term"]));

before(async () => {
  await en.prepare?.({ pos: true });
});

const WORDS = new Set(["including", "specified", "crowd", "work", "workflow", "description"]);

describe("isRunTogether", () => {
  it("two long dictionary words written as one", () => {
    assert.equal(isRunTogether("Includingspecified", WORDS), true);
    assert.equal(isRunTogether("descriptionspecified", WORDS), true);
  });

  it("not a dictionary word, a compound of short roots, an unknown word, or a word with marks", () => {
    assert.equal(isRunTogether("Description", WORDS), false);
    assert.equal(isRunTogether("crowdwork", WORDS), false);
    assert.equal(isRunTogether("Specifiedness", WORDS), false);
    assert.equal(isRunTogether("including-specified", WORDS), false);
    assert.equal(isRunTogether("", WORDS), false);
    assert.equal(isRunTogether("Includingspecified", new Set()), false);
  });
});

describe("undefined-term: a run-together word", () => {
  it("does not report a capitalised run that holds a run-together word, and reports one that does not", () => {
    const text = [
      'This Agreement is made by Northwind, Inc. (the "Company") and the members (each a "Member").',
      "",
      "The Company provides 1,500 square feet of Leased/rent office Space Includingspecified Description of duty.",
      "",
      "The Member pays the Monthly Service Fee within ten days.",
      "",
    ].join("\n");
    assert.deepEqual(termsIn(text), ["Monthly Service Fee"]);
  });
});
