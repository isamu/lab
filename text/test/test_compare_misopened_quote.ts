import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { readMarkdown } from "../packages/chaff/src/markdown-read.ts";
import { extractFacts } from "../packages/chaff/src/compare/extract.ts";
import { outcomeOf, type Outcome } from "../packages/chaff/src/compare/outcome.ts";
import { misopenedQuotes } from "../packages/chaff/src/compare/misopened-quotes.ts";

// chaff compare: a quotation opened with the closing mark (”…”) is a quotation. Repairing its marks changes how it is
// written, not what is quoted. Every text here is written for the test.

const insides = (text: string): string[] => misopenedQuotes(text, []).map((span) => text.slice(span.start, span.end));

const compare = (beforeText: string, afterText: string): Outcome => {
  const facts = (source: string) => {
    const doc = buildDocument("a.md", source, en, { jargon: [], requiredSections: [], names: [] });
    return extractFacts({ doc, root: readMarkdown(doc.source).root, structure: en.structure, names: [] });
  };
  return outcomeOf({ path: "before.md", extraction: facts(beforeText) }, { path: "after.md", extraction: facts(afterText) });
};

before(async () => {
  await en.prepare?.({ pos: true });
});

describe("misopenedQuotes", () => {
  it("reads a quotation opened with ”", () => {
    assert.deepEqual(insides("For the alt text, enter ”Visit our help page.” and save."), ["Visit our help page."]);
    assert.deepEqual(insides("”Opening words” start the line."), ["Opening words"]);
    assert.deepEqual(insides("The label (”Save”) is short."), ["Save"]);
  });

  it("does not read an inch mark, a mark inside a word, or a mark with a space inside", () => {
    assert.deepEqual(insides("A 5” screen and a 6” case."), []);
    assert.deepEqual(insides("It said” nothing ”more."), []);
    assert.deepEqual(insides("Enter ” spaced ” words."), []);
    assert.deepEqual(insides("Enter ”unclosed words."), []);
    assert.deepEqual(insides(""), []);
  });

  it("does not run over a line break or read inside a quotation already read", () => {
    assert.deepEqual(insides("Enter ”first line\nsecond line” now."), []);
    const text = "He wrote “keep ”this” here” today.";
    const outer = { start: text.indexOf("keep"), end: text.indexOf(" today") - 1 };
    assert.deepEqual(misopenedQuotes(text, [outer]), []);
    const closed = "“outer ”inner”";
    assert.deepEqual(misopenedQuotes(closed, [{ start: 1, end: 7 }]), []);
  });
});

describe("chaff compare and a repaired quotation mark", () => {
  const BEFORE = "# Signatures\n\nFor the logo, enter ”Visit our help page.” as the alt text.\n";
  const AFTER = "# Signatures\n\nFor the logo, enter “Visit our help page.” as the alt text.\n";

  it("reads the repair as the same quotation written another way", () => {
    const outcome = compare(BEFORE, AFTER);
    assert.equal(outcome.ok, true);
    assert.deepEqual(
      outcome.reformed.map((pair) => `${pair.before.text}→${pair.after.text}`),
      ["”Visit our help page.”→“Visit our help page.”"],
    );
  });

  it("does not read one inside code", () => {
    assert.deepEqual(compare("Use `”raw text”` here.\n", "Use `”raw text”` here.\n").before.counts.quote, 0);
  });

  it("still reports a quotation the rewrite dropped", () => {
    const outcome = compare(BEFORE, "# Signatures\n\nFor the logo, enter alt text.\n");
    assert.deepEqual(
      outcome.dropped.filter((change) => change.kind === "quote").map((change) => change.key),
      ["Visit our help page."],
    );
  });
});
