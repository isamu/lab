import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { parseRoman } from "../packages/lang-en/src/roman.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import { toSexp } from "../packages/chaff/src/structure/sexp.ts";
import type { StructureNode, StructurePatterns } from "../packages/chaff/src/plugin.ts";

const patterns = (): StructurePatterns => {
  if (en.structure === undefined) throw new Error("lang-en has no structure");
  return en.structure;
};

const treeOf = (source: string, markdown = false): StructureNode => buildStructure({ path: "c.txt", source, language: "en", markdown }, patterns());

const body = (source: string): string => toSexp(treeOf(source)).split("\n").slice(1).join("\n");

const lines = (...rows: string[]): string => rows.join("\n");

const addresses = (node: StructureNode): string[] => [...(node.address === "" ? [] : [node.address]), ...node.children.flatMap(addresses)];

describe("an English contract as a tree", () => {
  it("articles, sections, lettered and roman items, definitions, references, obligations, quantities", () => {
    const source = lines(
      "ARTICLE I. DEFINITIONS",
      '"Products" means the goods listed in Schedule A.',
      'The fees payable by the Buyer (the "Fees") are set out in Section 4.2(a).',
      "ARTICLE II — PAYMENT",
      "Section 4.2 Payment Terms",
      "(a) The Buyer shall pay the Fees within 30 days of delivery.",
      "(i) Payment may be made by wire transfer.",
      "(ii) Late fees shall not exceed $1,000.",
      "(b) The Seller must deliver the Products.",
    );
    assert.equal(
      body(source),
      lines(
        '  (article "1" :heading "DEFINITIONS" :label "Article I" :line 1',
        '    (definition :term "Products" :line 2)',
        '    (definition :term "Fees" :line 3)',
        '    (reference :label "Section 4.2(a)" :numbering "section" :target "4.2.a" :line 3))',
        '  (article "2" :heading "PAYMENT" :label "Article II" :line 4',
        '    (article "4.2" :heading "Payment Terms" :label "Section 4.2" :line 5',
        '      (item "4.2.a" :label "(a)" :line 6',
        '        (obligation :marker "shall" :type "must" :line 6)',
        '        (quantity :unit "days" :value 30 :line 6)',
        '        (item "4.2.a.i" :label "(i)" :line 7',
        '          (obligation :marker "may" :type "may" :line 7))',
        '        (item "4.2.a.ii" :label "(ii)" :line 8',
        '          (obligation :marker "shall not" :type "must-not" :line 8)',
        '          (quantity :unit "$" :value 1000 :line 8)))',
        '      (item "4.2.b" :label "(b)" :line 9',
        '        (obligation :marker "must" :type "must" :line 9)))))',
      ),
    );
  });

  it("a sentence that starts with “Article 3” is not the heading of Article 3", () => {
    const tree = treeOf(lines("Article 1 Scope", "Article 3 shall apply to all orders."));
    assert.deepEqual(addresses(tree), ["1"]);
    assert.equal(tree.children[0]?.children[0]?.attrs["target"], "3");
  });

  it("reads an inserted subsection “(A1)” or “(2A)” as a subsection outside the sequence", () => {
    // Data Protection Act 2018, section 82 (Open Government Licence v3.0), shortened.
    const source = lines(
      "Section 82 Processing to which this Part applies",
      "(A1) This Part—",
      "(a) applies to processing by an intelligence service, and",
      "(b) applies to processing by a qualifying competent authority.",
      "(1) This Part applies only to—",
      "(a) processing wholly or partly by automated means, and",
      "(2) In this Part, “intelligence service” means the Security Service.",
      "(2A) In this Part, “competent authority” has the same meaning as in Part 3.",
      "(3) A reference in this Part to processing is to processing to which this Part applies.",
    );
    assert.deepEqual(addresses(treeOf(source)), ["82", "82.A1", "82.A1.a", "82.A1.b", "82.1", "82.1.a", "82.2", "82.2A", "82.3"]);
    const ordinals = (node: StructureNode): (number | undefined)[] => [
      ...(node.kind === "item" && node.level === 2 ? [node.ordinal] : []),
      ...node.children.flatMap(ordinals),
    ];
    assert.deepEqual(ordinals(treeOf(source)), [undefined, 1, 2, undefined, 3]);
    const targets = (patterns().references("See section 82(A1)(b) and section 82(2A).") ?? []).map((mention) => mention.attrs["target"]);
    assert.deepEqual(targets, ["82.A1.b", "82.2A"]);
  });

  it("reads (i) as a roman numeral under (a), and as a letter after (h)", () => {
    const tree = treeOf(lines("Section 1 Terms", "(a) one", "(i) sub one", "(ii) sub two", "(b) two", "(h) eight", "(i) nine", "(j) ten"));
    assert.deepEqual(addresses(tree), ["1", "1.a", "1.a.i", "1.a.ii", "1.b", "1.h", "1.i", "1.j"]);
  });

  it("gives a reference the same address the tree gives its target", () => {
    const tree = treeOf(lines("Section 1 Terms", "(a) one", "(ii) two", "See Section 1(a)(ii) and Article IV."));
    const targets = tree.children[0]?.children[0]?.children[0]?.children.map((node) => node.attrs["target"]);
    assert.deepEqual(targets, ["1.a.ii", "4"]);
  });

  it("does not read a reference inside Markdown inline code", () => {
    const tree = treeOf(lines("# Notes", "", "Use `Section 99.1(a)` in examples, but see Section 2."), true);
    assert.deepEqual(
      tree.children[0]?.children.map((node) => node.attrs["target"]),
      ["2"],
    );
  });

  it("returns on a line with thousands of markers or parentheses instead of exhausting the stack", () => {
    const markers = treeOf(`The Buyer ${"may ".repeat(20_000)}pay.`).children.filter((node) => node.kind === "obligation");
    assert.equal(markers.length, 20_000);
    const reference = treeOf(`See Section 1${"(a)".repeat(20_000)}.`).children[0];
    assert.equal(reference?.attrs["target"], "1.a.a.a.a");
  });

  it("does not read a reference inside inline code in a heading", () => {
    const tree = treeOf(lines("# Using `Section 99` in docs", "", "## Section 2 Terms"), true);
    assert.deepEqual(addresses(tree), ["h1", "2"]);
    assert.deepEqual(
      tree.children[0]?.children.filter((node) => node.kind === "reference"),
      [],
    );
  });

  it("counts “shall not” once, not also as “shall”", () => {
    const markers = treeOf("The Buyer shall not assign.").children.map((node) => node.attrs["marker"]);
    assert.deepEqual(markers, ["shall not"]);
  });

  it("reads a currency right before the number, with or without one space", () => {
    assert.deepEqual(
      treeOf("Pay $1,000 or USD 500 or €20 and 3 more.").children.map((node) => [node.attrs["value"], node.attrs["unit"]]),
      [
        [1000, "$"],
        [500, "USD"],
        [20, "€"],
      ],
    );
  });

  it("does not take a bare number without a unit or currency as a quantity", () => {
    assert.deepEqual(
      treeOf("There are 3 parties and 12 months of support.").children.map((node) => [node.attrs["value"], node.attrs["unit"]]),
      [[12, "months"]],
    );
  });
});

describe("later members of a reference list are references too", () => {
  const withDocument = (target: string, document: string | number | undefined): string => (document === undefined ? target : `${target}@${String(document)}`);
  const targets = (text: string): string[] =>
    patterns()
      .references(text)
      .map((mention) => withDocument(String(mention.attrs["target"]), mention.attrs["document"]));

  it("every number after a plural word", () => {
    assert.deepEqual(targets("Sections 1, 2 and 9 apply."), ["1", "2", "9"]);
  });

  it("after a singular word, only a number where the list goes on or ends — not “4 days”", () => {
    assert.deepEqual(targets("Section 3 and 4 days later."), ["3"]);
    assert.deepEqual(targets("Section 3 or 4."), ["3", "4"]);
  });

  it("a member that is only parentheses stands beside the part written the same way", () => {
    // Data Protection Act 2018, sections 49 and 186 (Open Government Licence v3.0).
    assert.deepEqual(targets("for the purposes of sections 45(3)(b) and (5), 48(2)(b) and 53(7)."), ["45.3.b", "45.5", "48.2.b", "53.7"]);
    assert.deepEqual(targets("Article 58(2)(c) to (g) and (j) of the UK GDPR"), ["58.2.c@UK GDPR", "58.2.g@UK GDPR", "58.2.j@UK GDPR"]);
  });

  it("members carry the document the list ends in", () => {
    assert.deepEqual(targets("sections 5(7), 29(2) and 9 of the Tribunals Act"), ["5.7@Tribunals Act", "29.2@Tribunals Act", "9@Tribunals Act"]);
  });

  it("a member with a letter (45A) is not read, as the reference itself would not be", () => {
    assert.deepEqual(targets("see sections 44 and 45A"), ["44"]);
  });

  it("roman members in a list of Articles, with the document the list ends in", () => {
    assert.deepEqual(targets("Articles IV, V and VI of the Master Agreement apply."), ["4@Master Agreement", "5@Master Agreement", "6@Master Agreement"]);
    assert.deepEqual(targets("Articles IV and V apply."), ["4", "5"]);
  });

  it("a roman letter after a list of numbers is not a member", () => {
    assert.deepEqual(targets("Sections 2 and I agree."), ["2"]);
  });

  it("a list that switches document part-way stops at the switch (not read further)", () => {
    // "3 of the Y Act" is left out rather than guessed; a missed reference, never a false one.
    assert.deepEqual(targets("Sections 1 and 2 of this Act and 3 of the Y Act"), ["1", "2"]);
  });

  it("a later “section 6” is its own reference, not a member", () => {
    assert.deepEqual(targets("section 5 and section 6"), ["5", "6"]);
  });
});

describe("parseRoman", () => {
  const cases: readonly (readonly [string, number | undefined])[] = [
    ["I", 1],
    ["iv", 4],
    ["IX", 9],
    ["xii", 12],
    ["XL", 40],
    ["", undefined],
    ["IIa", undefined],
  ];
  cases.forEach(([text, expected]) => {
    it(`${text || "(empty)"} → ${String(expected)}`, () => assert.equal(parseRoman(text), expected));
  });
});
