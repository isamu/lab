import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { isTitle, parentAndLabels, writtenHeadings, writtenSubdivisions } from "../packages/chaff/src/structure/written-headings.ts";

// dangling-reference in English: plain-text contracts that write their headings as text ("9. Indemnification.",
// "Section 2.3   Appraisal Shares."), and "section 21 notice", which names another Act's section. All text is self-written.

const lines = (...rows: string[]): string => rows.join("\n");

const danglingLabels = (source: string, path = "contract.txt", genre = "legal/contract"): string[] =>
  runRules(buildDocument(path, source, en), loadRules("en"), {}, true, genre)
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

describe("isTitle", () => {
  const cases: readonly (readonly [string, boolean])[] = [
    ["Indemnification", true],
    ["Effect on Capital Stock of the Company and Merger Sub", true],
    ["Compliance with Laws and Court Orders; Licenses", true],
    ["Term and Termination", true],
    ["Broker’s Fees", true],
    ["The Company shall comply with the law", false],
    ["Reserves 33 Section 3.18 Capital", false],
    ["at the end of the term", false],
    ["", false],
    ["One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen", false],
  ];
  cases.forEach(([title, expected]) => {
    it(`${JSON.stringify(title)} → ${String(expected)}`, () => assert.equal(isTitle(title), expected));
  });
});

describe("writtenHeadings", () => {
  const addresses = (source: string, references: readonly { start: number; end: number; target: string }[] = []): string[] =>
    writtenHeadings(references, source).map((heading) => heading.address);
  const at = (source: string, label: string, target: string): { start: number; end: number; target: string } => {
    const start = source.indexOf(label);
    return { start, end: start + label.length, target };
  };

  it("reads a numbered title at the start of a line", () => {
    assert.deepEqual(addresses("9. Indemnification. Each party shall defend the other."), ["9"]);
    assert.deepEqual(addresses("4 Intellectual Property. 4.1 Each party keeps its own rights."), ["4"]);
  });
  it("reads a dotted number before a paragraph whose first word has a capital", () =>
    assert.deepEqual(addresses("6.1 eGain warrants that the software will perform as the documentation describes in every material respect at all times."), [
      "6.1",
    ]));
  it("does not read a sentence, a table-of-contents line, or a wrapped number", () => {
    assert.deepEqual(addresses("1. Read the form before you sign it."), []);
    assert.deepEqual(addresses("3.17 Reserves 33"), []);
    assert.deepEqual(addresses("1. Introduction"), []);
    assert.deepEqual(addresses("2. Indemnification."), []);
    assert.deepEqual(addresses("2.5 percent of the fee is due when the order is placed and the rest when the goods arrive at the port."), []);
  });
  it("reads a heading written where a reference stands, after a line start, a sentence end or a run of spaces", () => {
    const inline = "an Adverse Effect. Section 4.12. Compliance with Laws. (a) The Company holds its licences.";
    assert.deepEqual(addresses(inline, [at(inline, "Section 4.12", "4.12")]), ["4.12"]);
    const spaced = "THE MERGER   Section 1.1           Closing. The parties shall close.";
    assert.deepEqual(addresses(spaced, [at(spaced, "Section 1.1", "1.1")]), ["1.1"]);
  });
  it("does not read a reference inside a sentence, a contents entry, or the title of another heading", () => {
    const body = "as set out in Section 3.17. The Company Board.";
    assert.deepEqual(addresses(body, [at(body, "Section 3.17", "3.17")]), []);
    const contents = "Section 1.01. Definitions    1  Section 1.02. Other Provisions    10";
    assert.deepEqual(addresses(contents, [at(contents, "Section 1.01", "1.01"), at(contents, "Section 1.02", "1.02")]), []);
    const titled = "it ends here. Section 8.07. Section 16 Matters. The Company shall act.";
    assert.deepEqual(addresses(titled, [at(titled, "Section 16", "16")]), []);
  });
});

describe("writtenSubdivisions and parentAndLabels", () => {
  it("reads labels written in the text, not the ones inside a reference", () => {
    assert.deepEqual([...writtenSubdivisions("warrants that (i) the software works and (ii) the service is kept")], ["i", "ii"]);
    assert.deepEqual([...writtenSubdivisions("as set out in Section 2.02(b) and (a)(i)")], ["a"]);
    assert.deepEqual([...writtenSubdivisions("")], []);
  });
  it("splits a target into its parent and the labels the reference writes in parentheses", () => {
    assert.deepEqual(parentAndLabels("2.1.a.i", "Section 2.1(a)(i)"), { parent: "2.1", labels: ["a", "i"] });
    assert.deepEqual(parentAndLabels("163.25.e", "§ 163.25(e)"), { parent: "163.25", labels: ["e"] });
    assert.equal(parentAndLabels("2.1", "Section 2.1"), undefined);
    assert.equal(parentAndLabels("4.2.3", "Section 4.2.3"), undefined);
    assert.equal(parentAndLabels("a", "(a)"), undefined);
    assert.equal(parentAndLabels("", ""), undefined);
  });
});

describe("dangling-reference on a plain-text contract", () => {
  const contract = (reference: string): string =>
    lines(
      "HOSTING AGREEMENT",
      "",
      "1. Services. The Provider will host the Software for the Customer.",
      "",
      "2. Fees. The Customer will pay the fees set out in the order.",
      "",
      "2.1 Late Payment. Late fees accrue at one percent per month.",
      "",
      "3. Warranties.",
      "",
      "3.1 The Provider warrants that (i) the Software will perform as documented and (ii) the hosting will be done with care and skill by trained staff.",
      "",
      "4. Indemnification. The Provider will defend the Customer against third-party claims.",
      "",
      `5. Termination. Either party may end this Agreement as set out in ${reference}.`,
    );

  it("finds a section written as a plain-text heading", () => assert.deepEqual(danglingLabels(contract("Section 4")), []));
  it("finds a lettered part written inside the section's text", () => assert.deepEqual(danglingLabels(contract("Section 3.1(ii)")), []));
  it("still reports a section the contract does not have", () => assert.deepEqual(danglingLabels(contract("Section 9")), ["Section 9"]));
  it("still reports a part the section does not write", () => assert.deepEqual(danglingLabels(contract("Section 3.1(iv)")), ["Section 3.1(iv)"]));

  it("reads a heading run into a line, as a dataset that lost the line breaks writes it", () => {
    const flattened = lines(
      "ARTICLE I   THE MERGER   Section 1.1           Closing. The parties shall close on the third day.   Section 1.2          The Merger. The merger takes effect on filing, as Section 1.1 says.",
      "",
      "ARTICLE II   OTHER TERMS   Section 2.1          Notices. Notices are given in writing under Section 1.2 and Section 2.9.",
    );
    assert.deepEqual(danglingLabels(flattened), ["Section 2.9"]);
  });
});

describe("a section number that names another Act's form (section 21 notice)", () => {
  const guide = (paragraph: string): string =>
    lines("# Renting guide", "", "## 1. Before you rent", "", "Read the guide.", "", "## 2. Ending a tenancy", "", paragraph);

  it("does not report section 21 when the text names a section 21 notice", () =>
    assert.deepEqual(
      danglingLabels(guide("Your landlord can give you a section 21 notice. Under section 21 the court decides."), "guide.md", "docs/manual"),
      [],
    ));
  it("reads a section 8 form the same way", () => assert.deepEqual(danglingLabels(guide("Fill in a section 8 form."), "guide.md", "docs/manual"), []));
  it("still reports a section without such a name", () =>
    assert.deepEqual(danglingLabels(guide("Under section 21 the court decides."), "guide.md", "docs/manual"), ["section 21"]));
  it("still reports a capitalised Section 21 in a text that names a section 21 notice", () =>
    assert.deepEqual(danglingLabels(guide("Give a section 21 notice as Section 21 says."), "guide.md", "docs/manual"), ["Section 21"]));
  it("does not read a capitalised Section N notice as a name: it points into the document", () =>
    assert.deepEqual(danglingLabels(guide("Give a Section 9 notice to the landlord."), "guide.md", "docs/manual"), ["Section 9"]));
});
