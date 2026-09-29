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

  it("reads (i) as a roman numeral under (1), as US regulations go (a)(1)(i)", () => {
    // 16 CFR 310.3(a) (public domain), shortened.
    const source = lines(
      "§ 310.3 Deceptive telemarketing acts or practices.",
      "(a) Prohibited deceptive telemarketing acts or practices.",
      "(1) Before a customer consents to pay, failing to disclose:",
      "(i) The total costs to purchase the goods or services;",
      "(ii) All material restrictions on the goods or services;",
      "(2) Misrepresenting any of the following material information:",
      "(i) The total costs to purchase the goods or services;",
      "(b) Assisting and facilitating, in violation of § 310.3(a)(1)(i) or (a)(2)(i).",
    );
    const tree = treeOf(source);
    assert.deepEqual(addresses(tree), ["310.3", "310.3.a", "310.3.a.1", "310.3.a.1.i", "310.3.a.1.ii", "310.3.a.2", "310.3.a.2.i", "310.3.b"]);
  });

  it("keeps the letter (i) after (h) under a numbered subsection a letter, so (j) sits beside it", () => {
    const source = lines("Section 1 Terms", "(1) In this Act:", "(g) seven", "(h) eight", "(i) nine", "(j) ten", "(2) Next.");
    assert.deepEqual(addresses(treeOf(source)), ["1", "1.1", "1.1.g", "1.1.h", "1.1.i", "1.1.j", "1.2"]);
  });

  it("reads (A) under a roman item, and a (1) under (C) a level below it, as US regulations go (a)(1)(i)(A)(1)", () => {
    // 16 CFR 310.4(a)(5) (public domain), shortened. "(5)" stands alone on its line in the eCFR.
    const source = lines(
      "§ 310.4 Abusive telemarketing acts or practices.",
      "(a) Abusive conduct generally.",
      "(4) Requesting or receiving payment of any fee or consideration in advance of obtaining a loan;",
      "(5)",
      "(i) Requesting or receiving payment of any fee for any debt relief service until and unless:",
      "(A) The seller or telemarketer has renegotiated at least one debt;",
      "(B) The customer has made at least one payment; and",
      "(C) To the extent that debts enrolled in a service are renegotiated individually, the fee:",
      "(1) Bears the same proportional relationship to the total fee; or",
      "(2) Is a percentage of the amount saved.",
      "(ii) Nothing in § 310.4(a)(5)(i) prohibits requesting or requiring the customer to place funds in an account:",
      "(A) The funds are held in an account at an insured financial institution;",
      "(6) Disclosing or receiving, for consideration, unencrypted consumer account numbers.",
    );
    assert.deepEqual(addresses(treeOf(source)), [
      "310.4",
      "310.4.a",
      "310.4.a.4",
      "310.4.a.5",
      "310.4.a.5.i",
      "310.4.a.5.i.A",
      "310.4.a.5.i.B",
      "310.4.a.5.i.C",
      "310.4.a.5.i.C.1",
      "310.4.a.5.i.C.2",
      "310.4.a.5.ii",
      "310.4.a.5.ii.A",
      "310.4.a.6",
    ]);
  });

  it("reads an (i) under (A) a level below it, and a (B) after it beside (A)", () => {
    // 16 CFR 310.4(b)(1)(v) (public domain), shortened.
    const source = lines(
      "§ 310.4 Abusive telemarketing acts or practices.",
      "(b) Pattern of calls.",
      "(1) It is an abusive telemarketing act or practice:",
      "(v) Initiating any outbound telephone call that delivers a prerecorded message, unless:",
      "(A) The seller has obtained from the recipient of the call an express agreement, in writing, that:",
      "(i) The seller obtained only after a clear and conspicuous disclosure;",
      "(ii) The seller obtained without requiring that the agreement be executed as a condition of purchasing;",
      "(B) In any such call, the seller or telemarketer:",
      "(i) Allows the telephone to ring for at least fifteen (15) seconds; and",
      "(C) Any call that complies with this paragraph (v) shall not be deemed to violate § 310.4(b)(1)(iv).",
      "(2) It is an abusive telemarketing act or practice for any person to sell any list.",
    );
    const expected = ["310.4", "310.4.b", "310.4.b.1", "310.4.b.1.v", "310.4.b.1.v.A", "310.4.b.1.v.A.i", "310.4.b.1.v.A.ii"];
    assert.deepEqual(addresses(treeOf(source)), [...expected, "310.4.b.1.v.B", "310.4.b.1.v.B.i", "310.4.b.1.v.C", "310.4.b.2"]);
  });

  it("reads (I) under a roman item as a capital roman numeral, and (II) beside it", () => {
    const source = lines("Section 1 Terms", "(a) one", "(1) one", "(i) one", "(I) one", "(II) two", "(ii) two");
    assert.deepEqual(addresses(treeOf(source)), ["1", "1.a", "1.a.1", "1.a.1.i", "1.a.1.i.I", "1.a.1.i.II", "1.a.1.ii"]);
  });

  it("leaves a capital (A) that opens a list, or sits under a number, as text, as it was", () => {
    const contract = lines("Section 1 Recitals", "(A) The Supplier provides services.", "(B) The Customer wishes to buy them.", "(a) one");
    assert.deepEqual(addresses(treeOf(contract)), ["1", "1.a"]);
    const code = lines("Section 1 Terms", "(a) one", "(1) one", "(A) one", "(B) two", "(2) two");
    assert.deepEqual(addresses(treeOf(code)), ["1", "1.a", "1.a.1", "1.a.2"]);
  });

  it("reads a label alone on its line only as the next of an open list", () => {
    assert.deepEqual(addresses(treeOf(lines("Section 1 Terms", "(1) one", "(2)", "(a) two a"))), ["1", "1.1", "1.2", "1.2.a"]);
    const equation = lines("Section 1 Terms", "The ratio is x = y / z", "(1)", "and it holds.");
    assert.deepEqual(addresses(treeOf(equation)), ["1"]);
    assert.deepEqual(addresses(treeOf(lines("Section 1 Terms", "(1) one", "(3)", "(1) again"))), ["1", "1.1", "1.1"]);
    assert.deepEqual(addresses(treeOf(lines("Section 1 Terms", "(1) one", "(1)"))), ["1", "1.1"]);
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
    assert.equal(reference?.attrs["target"], "1.a.a.a.a.a");
  });

  it("reads a capital in a reference only after a roman part, as the tree reads it only under a roman item", () => {
    const targets = (text: string): unknown[] => treeOf(text).children.map((node) => node.attrs["target"]);
    assert.deepEqual(targets("See § 310.4(b)(1)(iii)(B)."), ["310.4.b.1.iii.B"]);
    assert.deepEqual(targets("See § 310.4(a)(5)(i)(C)(1) and Section 2(a)(ii)(I)."), ["310.4.a.5.i.C.1", "2.a.ii.I"]);
    assert.deepEqual(targets("See section 5(A) and Section 3(a)(B)."), ["5", "3.a"]);
    assert.deepEqual(targets("See Section 1(h)(i)(A)."), ["1.h.i"]);
    assert.deepEqual(targets("See Section 1(i)(A)."), ["1.i"]);
    assert.deepEqual(targets("See Section 1(a)(1)(i)(A)(1)(i)."), ["1.a.1.i.A.1"]);
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

  it("a dotted member (310.5) is not read as its head (310), after a singular or a plural word", () => {
    // 16 CFR 310.6 and 310.4(b)(3)(iv) (public domain), shortened.
    assert.deepEqual(targets("§§ 310.4(b)(1)(iii)(B) and 310.5 shall not apply."), ["310.4.b.1.iii.B"]);
    assert.deepEqual(targets("pursuant to § 310.4(b)(3)(iii) or 310.4(b)(1)(iii)(B), employing"), ["310.4.b.3.iii"]);
    assert.deepEqual(targets("see sections 3.1 and 3.2"), ["3.1"]);
    assert.deepEqual(targets("see sections 310.4 and 310.5"), ["310.4"]);
    assert.deepEqual(targets("see Sections 3 and 4."), ["3", "4"]);
    assert.deepEqual(targets("see Sections 3, 4 and 5 of the Act"), ["3@Act", "4@Act", "5@Act"]);
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
