import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { inEntryOfTerm, opensEntryOfTerm } from "../packages/chaff/src/detectors/term-mention-sentence.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Sentence } from "../packages/chaff/src/plugin.ts";

// defined-term-form: a lower-case word after the term named in quotes in the same sentence (an entry of a definitions
// list) is the definition's own body, not a use of the term. Self-written text only.

const RULE = "defined-term-form";

const variantsOf = (source: string, variant: string): string[] =>
  runRules(
    buildDocument("t.md", source, en, undefined, profileFor(EMPTY, "t.md", source, en.id, "legal/contract")),
    loadRules(en.id),
    {},
    false,
    "legal/contract",
  )
    .findings.filter((finding) => finding.rule === RULE && finding.variant === variant)
    .map((finding) => String(finding.values["term"]));

const casesOf = (source: string): string[] => variantsOf(source, "case");
const quotedOf = (source: string): string[] => variantsOf(source, "quoted");

const contract = (...lines: string[]): string =>
  [
    "# Partnership Agreement",
    "",
    '1. Each Partner has paid money into the firm (the "Capital Contribution").',
    "",
    "2. The Capital Contribution of a Partner earns no interest, and each Capital Contribution is recorded in the books.",
    "",
    ...lines,
    "",
  ].join("\n");

before(async () => {
  await en.prepare?.({ pos: true });
});

describe("defined-term-form: the body of a definitions entry", () => {
  it("valid: the lower-case words after the quoted term in its entry are not reported", () => {
    const source = contract("3. Definitions.", "", 'a. "Capital Contributions" The capital contribution paid by the Partners, in cash or property.');
    assert.deepEqual(casesOf(source), []);
  });

  it("invalid: a lower-case use in another sentence is still reported", () => {
    const source = contract("3. No Partner may withdraw any part of a capital contribution without consent.");
    assert.deepEqual(casesOf(source), ["Capital Contribution"]);
  });

  it("invalid: a sentence that quotes the term in its middle is no entry; its lower-case use is still reported", () => {
    const source = contract('3. The Partners named the payment the "Capital Contribution", but the capital contribution was never made.');
    assert.deepEqual(casesOf(source), ["Capital Contribution"]);
  });

  it("invalid: a lower-case use before the quoted term in the same sentence is still reported", () => {
    const source = contract('3. Any capital contribution paid in property counts toward the "Capital Contribution" of that Partner.');
    assert.deepEqual(casesOf(source), ["Capital Contribution"]);
  });
});

describe("defined-term-form: the quoted name that opens a definitions entry", () => {
  it("valid: the entry's own quoted name is a definition, not a quoted use", () => {
    const source = contract("3. Definitions.", "", 'a. "Capital Contributions" The capital contribution paid by the Partners, in cash or property.');
    assert.deepEqual(quotedOf(source), []);
  });

  it("valid: an entry whose name is followed by a colon", () => {
    const source = contract("3. Definitions.", "", '(a) "Capital Contribution": the money paid by the Partners.');
    assert.deepEqual(quotedOf(source), []);
  });

  it("invalid: the term quoted again in the middle of a sentence is still reported", () => {
    const source = contract('3. No Partner may withdraw the "Capital Contribution" without consent.');
    assert.deepEqual(quotedOf(source), ["Capital Contribution"]);
  });

  it("invalid: a sentence that opens with the quoted term and goes on as a sentence is still reported", () => {
    const source = contract('3. "Capital Contribution" earns no interest.');
    assert.deepEqual(quotedOf(source), ["Capital Contribution"]);
  });
});

describe("opensEntryOfTerm", () => {
  const head = (text: string): boolean => {
    const at = text.indexOf("Capital");
    return opensEntryOfTerm([{ text, span: { start: 0, end: text.length } }], "Capital Contribution", at);
  };

  it("valid: the quoted name of an entry, followed by its body in capitals, after a colon or a dash", () => {
    assert.equal(head('a. "Capital Contributions" The money paid.'), true);
    assert.equal(head('"Capital Contribution": the money paid.'), true);
    assert.equal(head("(b) “Capital Contribution” — the money paid."), true);
  });

  it("invalid: a quote in the middle, a sentence going on in lower case, or an offset outside the name", () => {
    assert.equal(head('Members call it "Capital Contribution" The money.'), false);
    assert.equal(head('"Capital Contribution" earns no interest.'), false);
    assert.equal(opensEntryOfTerm([{ text: '"Capital Contribution" The money.', span: { start: 0, end: 33 } }], "Capital Contribution", 25), false);
    assert.equal(opensEntryOfTerm([], "Capital Contribution", 1), false);
  });
});

describe("inEntryOfTerm", () => {
  const text = '"Capital Contributions" The capital contribution made.';
  const sentences: Sentence[] = [{ text, span: { start: 100, end: 100 + text.length } }];
  const lower = 100 + text.indexOf("capital contribution");

  const entry = (head: string): boolean => {
    const entryText = `${head} The capital contribution made.`;
    const at = entryText.indexOf("capital contribution");
    return inEntryOfTerm([{ text: entryText, span: { start: 0, end: entryText.length } }], "Capital Contribution", at);
  };

  it("valid: an entry that opens with the quoted term, with a plural or possessive ending, after an item label", () => {
    assert.equal(inEntryOfTerm(sentences, "Capital Contribution", lower), true);
    assert.equal(entry('(b) "Capital Contribution"'), true);
    assert.equal(entry("iv. “Capital Contribution's”"), true);
    assert.equal(entry("「Capital Contribution」"), true);
  });

  it("invalid: quotes that do not pair, a bare apostrophe, or a sentence that does not open with the quote", () => {
    assert.equal(entry("“Capital Contribution」"), false);
    assert.equal(entry('"Capital Contribution’"'), false);
    assert.equal(entry('Members call it "Capital Contribution"'), false);
  });

  it("invalid: another term quoted, an offset outside every sentence, or inside the quoted name", () => {
    assert.equal(inEntryOfTerm(sentences, "Majority Vote", lower), false);
    assert.equal(inEntryOfTerm(sentences, "Capital Contribution", 10), false);
    assert.equal(inEntryOfTerm(sentences, "Capital Contribution", 101), false);
  });
});
