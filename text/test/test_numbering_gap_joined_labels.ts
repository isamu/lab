import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { inDocumentOrder } from "../packages/chaff/src/structure/issues.ts";
import { styleOf } from "../packages/lang-en/src/item-style.ts";
import type { NumberedLine } from "../packages/chaff/src/plugin.ts";

// The US Code prints a subsection and its first paragraph on one line ("(c)(1) Whenever…", "(4)(A)(i) In order…"),
// numbers subparagraphs "(A)" under paragraphs "(1)" and clauses "(i)" under them, items under a subclause "(I)" with a
// doubled letter "(aa)", and keeps a repealed item in brackets ("[(D) Repealed. …]"). numbering-gap read the joined line
// as no item and reported the next subsection as a gap. Lines from 18 U.S.C. 1030 and 5 U.S.C. 552 (public domain,
// chaff-corpus #54); the others are self-written.

const SOURCE = (...body: string[]): string => ["### §103. Fraud and related activity", "", ...body].join("\n\n");

const gaps = (...body: string[]): string[] =>
  runRules(buildDocument("s.md", SOURCE(...body), en), loadRules("en"), {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => `${String(finding.values["label"] ?? "")}`);

const addresses = (...body: string[]): string[] => {
  const tree = buildDocument("s.md", SOURCE(...body), en).structure;
  return tree === undefined ? [] : inDocumentOrder(tree).flatMap((node) => (node.kind === "item" ? [node.address] : []));
};

describe("numbering-gap and joined labels", () => {
  it("valid: a subsection joined to its first paragraph opens both", () => {
    const body = [
      "(a) Whoever—",
      "(1) having knowingly accessed a computer;",
      "(2) intentionally accesses a computer;",
      "(b) Whoever conspires to commit an offense.",
      "(c)(1) The punishment for an offense under subsection (a) is a fine.",
      "(2) a fine under this title in any other case.",
      "(d) The United States Secret Service shall have authority to investigate offenses.",
    ];
    assert.deepEqual(gaps(...body), []);
    assert.deepEqual(addresses(...body), ["103.a", "103.a.1", "103.a.2", "103.b", "103.c", "103.c.1", "103.c.2", "103.d"]);
  });

  it("valid: three joined labels, clauses under subparagraphs, a repealed item and doubled letters", () => {
    const body = [
      "(a) Each agency shall make information available.",
      "(4)(A)(i) In order to carry out the provisions of this section, each agency shall promulgate regulations.",
      "(ii) Such agency regulations shall provide that—",
      "(I) fees shall be limited to reasonable standard charges; or",
      "(II)(aa) If an agency has determined that unusual circumstances apply, the agency may charge.",
      "(bb) If more than 5,000 pages are necessary, the agency may charge.",
      "(B) On complaint, the district court has jurisdiction.",
      "[(C) Repealed.]",
      "(D) The court shall determine the matter de novo.",
    ];
    assert.deepEqual(gaps(...body), []);
    assert.deepEqual(addresses(...body), [
      "103.a",
      "103.a.4",
      "103.a.4.A",
      "103.a.4.A.i",
      "103.a.4.A.ii",
      "103.a.4.A.ii.I",
      "103.a.4.A.ii.II",
      "103.a.4.A.ii.II.aa",
      "103.a.4.A.ii.II.bb",
      "103.a.4.B",
      "103.a.4.C",
      "103.a.4.D",
    ]);
  });

  it("invalid: a gap after a joined line is still reported", () => {
    assert.deepEqual(gaps("(a) Whoever—", "(b) Whoever conspires.", "(c)(1) The punishment is a fine.", "(2) a fine.", "(e) As used in this section—"), [
      "(e)",
    ]);
  });

  it("valid: a list that writes its parent's label on every line is that parent's list", () => {
    assert.deepEqual(gaps("(a)(i) The parties agree.", "(a)(ii) The parties must.", "(b) Fees."), []);
    assert.deepEqual(addresses("(a)(i) The parties agree.", "(a)(ii) The parties must.", "(b) Fees."), ["103.a", "103.a.i", "103.a.ii", "103.b"]);
  });

  it("invalid: a gap in a list that writes its parent's label on every line is reported", () => {
    assert.deepEqual(gaps("(a)(i) The parties agree.", "(a)(iii) The parties must."), ["(iii)"]);
  });

  it("invalid: a missing paragraph inside a joined subsection is still reported", () => {
    assert.deepEqual(gaps("(a)(1) The first paragraph.", "(3) The third paragraph."), ["(3)"]);
  });
});

const open = (label: string, depth: number, ordinal: number): NumberedLine => ({
  kind: "item",
  depth,
  number: label,
  absolute: false,
  label: `(${label})`,
  heading: "",
  rest: "",
  ordinal,
});

describe("styleOf: capitals and doubled letters", () => {
  it("a capital A starts under a paragraph (1) as well as under a clause (i)", () => {
    assert.equal(styleOf("A", { open: [open("a", 1, 1), open("1", 2, 1)], isHeading: false }), "capital");
    assert.equal(styleOf("A", { open: [open("a", 1, 1), open("1", 2, 1), open("i", 3, 1)], isHeading: false }), "capital");
  });

  it("a capital A at the top, under a letter or under a paragraph with no letter above stays text", () => {
    assert.equal(styleOf("A", { open: [], isHeading: false }), undefined);
    assert.equal(styleOf("A", { open: [open("1", 1, 1)], isHeading: false }), undefined);
    assert.equal(styleOf("A", { open: [open("a", 1, 1)], isHeading: false }), undefined);
  });

  it("an (i) right under a capital is a clause", () => {
    assert.equal(styleOf("i", { open: [open("a", 1, 1), open("1", 2, 1), open("A", 3, 1)], isHeading: false }), "roman");
  });

  it("a doubled letter is its own list only under a subclause (I) or beside another", () => {
    assert.equal(styleOf("aa", { open: [open("i", 1, 1), open("II", 2, 2)], isHeading: false }), "doubled");
    assert.equal(styleOf("aa", { open: [open("a", 1, 1)], isHeading: false }), "letter");
    assert.equal(styleOf("aa", { open: [], isHeading: false }), "letter");
    assert.equal(styleOf("ii", { open: [open("i", 1, 1), open("II", 2, 2)], isHeading: false }), "roman");
    assert.equal(styleOf("aaa", { open: [open("i", 1, 1), open("II", 2, 2)], isHeading: false }), "letter");
  });
});
