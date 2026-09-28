import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { unreadStructure } from "../packages/chaff/src/structure/unread.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { StructurePatterns } from "../packages/chaff/src/plugin.ts";

// A contract whose numbered clauses the tree could not read says so, instead of a silent "0 findings".
// The text is self-written; the SEC contracts it imitates (CUAD) are not committed.

const patterns = (): StructurePatterns => {
  if (en.structure === undefined) throw new Error("lang-en has no structure");
  return en.structure;
};

const lines = (...rows: string[]): string => rows.join("\n");

const unread = (source: string): ReturnType<typeof unreadStructure> =>
  unreadStructure(source, buildStructure({ path: "c.txt", source, language: "en", markdown: false }, patterns()));

// Clauses indented deeper than a numbered line, and clauses run into one line, as text extraction leaves them.
const INDENTED = lines(
  "        1.1. Term. This Agreement starts on the Effective Date.",
  "        1.2. Renewal. It renews each year.",
  "        2.1. Fees. The Customer pays the fees.",
  "        2.2. Taxes. The Customer pays the taxes.",
  "        3.1. Notices. Notices are in writing.",
);
const RUN_TOGETHER = "1.1 Term. It starts. 1.2 Renewal. It renews. 2.1 Fees. It pays. 2.2 Taxes. It pays. 3.1 Notices. In writing.";
const CAPITAL_HEADINGS = lines("1.   TERM OF CONTRACT", "text", "2.   DEFINITIONS", "text", "3.   FEES", "text", "4.   NOTICES", "text", "5.   LAW", "text");

describe("unreadStructure", () => {
  it("clauses indented too deep, or run into the text, are unread", () => {
    assert.deepEqual(unread(INDENTED), { clauses: 5, units: 0 });
    assert.deepEqual(unread(RUN_TOGETHER), { clauses: 5, units: 1 });
  });

  it("numbers before capital headings at the start of a line count as clauses", () => {
    assert.deepEqual(unread(CAPITAL_HEADINGS), { clauses: 5, units: 0 });
  });

  it("a contract whose clauses were read is not unread", () => {
    const read = lines("1.1 Term. It starts.", "1.2 Renewal. It renews.", "2.1 Fees. It pays.", "2.2 Taxes. It pays.", "3.1 Notices. In writing.");
    assert.equal(unread(read), undefined);
  });

  it("a few clause numbers are not enough to call a document numbered", () => {
    assert.equal(unread("See 1.1 Term and 1.2 Renewal. Nothing else is numbered."), undefined);
  });

  it("a number after a word (a version, a figure) is not a clause number", () => {
    const notes = lines(
      "Version 1.2 Released in May. Version 1.3 Released in June. Version 1.4 Released in July.",
      "Figure 2.1 Revenue grew. Figure 2.2 Costs fell. Table 3.1 Staff rose.",
    );
    assert.equal(unread(notes), undefined);
  });

  it("a bullet list “1. First” is not a clause number", () => {
    assert.equal(unread(lines("1. First", "2. Second", "3. Third", "4. Fourth", "5. Fifth", "6. Sixth")), undefined);
  });
});

describe("the structure rules say they could not read the document", () => {
  it("lists the reason instead of reporting nothing", () => {
    const rules = loadRules("en").filter((rule) => ["dangling-reference", "numbering-gap", "duplicate-definition"].includes(rule.id));
    const result = runRules(buildDocument("c.txt", INDENTED, en), rules, {}, true, "business/report");
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.skipped.map((skipped) => skipped.rule).sort(), ["dangling-reference", "duplicate-definition", "numbering-gap"]);
    assert.ok(result.skipped.every((skipped) => skipped.why.includes("5 clause numbers")));
  });
});
