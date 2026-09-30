import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { inDocumentOrder } from "../packages/chaff/src/structure/issues.ts";
import { numberingBreaks } from "../packages/chaff/src/structure/numbering.ts";
import { numbersQuotedInside } from "../packages/chaff/src/structure/quoted-number.ts";
import { codeVocabulary, titledCodeAt } from "../packages/lang-en/src/code-citation.ts";
import type { LanguageAdapter, StructureNode } from "../packages/chaff/src/plugin.ts";

// numbering-gap は、この文書の番号の並びだけを比べる。表の欄の数（版の番号）、ほかの法令の条番号を名乗る見出し、
// 引用とコードの中の番号は、この文書の番号ではない。例文は自作と plainlanguage.gov（CC0）の抜き書き。

const lines = (...rows: string[]): string => rows.join("\n");

type Gap = readonly [unknown, unknown];

const gapsOf = (adapter: LanguageAdapter, source: string, path = "c.md"): Gap[] =>
  runRules(buildDocument(path, source, adapter), loadRules(adapter.id), {}, true, "legal/contract")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => [finding.values["previous"], finding.values["label"]]);

const treeOf = (adapter: LanguageAdapter, source: string, path = "c.md"): StructureNode => {
  const tree = buildDocument(path, source, adapter).structure;
  if (tree === undefined) throw new Error("no structure");
  return tree;
};

const numberedLabels = (tree: StructureNode): unknown[] => inDocumentOrder(tree).flatMap((node) => (node.ordinal === undefined ? [] : [node.attrs["label"]]));

before(async () => prepare());

describe("a table's cells are data, not the document's numbering", () => {
  it("a revision-history table without leading pipes reports no gap", () => {
    const source = lines(
      "## Appendix A: Revision History",
      "",
      "Version   | Date       | Notes",
      "---       | ---        | ---",
      "2.1.0     | 2024-02-15 | Release of version 2.1.0",
      "2.0.3     | 2023-02-20 | Patch release 2.0.3",
      "2.0.2     | 2022-10-08 | Patch release 2.0.2",
      "2.0       | 2021-12-31 | Release of version 2.0",
      "1.0       | 2020-08-10 | First release",
      "",
    );
    assert.deepEqual(gapsOf(en, source), []);
    assert.deepEqual(numberedLabels(treeOf(en, source)), []);
  });

  it("a Japanese table without leading pipes opens no article", () => {
    const source = lines("条 | 内容", "--- | ---", "第1条 | 目的", "第3条 | 定義", "");
    assert.deepEqual(gapsOf(ja, source), []);
    assert.deepEqual(numberedLabels(treeOf(ja, source)), []);
  });

  it("amounts and dates in the table's cells are still read", () => {
    const source = lines("Item | Price | Date", "--- | --- | ---", "1.1 | $5,000 | 2024-02-15", "");
    const kinds = inDocumentOrder(treeOf(en, source)).map((node) => node.kind);
    assert.ok(kinds.includes("quantity"));
    assert.ok(kinds.includes("date"));
  });

  it("a gap in the numbered headings around a table is still reported", () => {
    const source = lines("## 1. Scope", "", "Version | Date", "--- | ---", "2.0 | 2021", "1.0 | 2020", "", "## 3. Terms", "", "Text.", "");
    assert.deepEqual(gapsOf(en, source), [["1", "3"]]);
  });

  it("a gap in a Japanese statute next to a table is still reported", () => {
    const source = lines("第1条 目的", "", "項目 | 金額", "--- | ---", "報酬 | 5,000円", "", "第2条 定義", "", "第3条 雑則", "", "第5条 附則", "");
    assert.deepEqual(gapsOf(ja, source), [["第3条", "第5条"]]);
  });

  it("a plain-text document has no tables, so its numbered lines are read as before", () => {
    const source = lines("1.1 Scope", "", "1.3 Terms", "");
    assert.deepEqual(gapsOf(en, source, "c.txt"), [["1.1", "1.3"]]);
  });
});

describe("a section number of another code is not this document's numbering", () => {
  it("a heading that starts with a code's title number (40 CFR § 163.25) is not section 40", () => {
    const source = lines("## 40 CFR § 163.25 Forest management deductions", "", "Text.", "", "## 40 CFR § 163.17 Deposit with bid", "", "Text.", "");
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("the same for U.S.C. and a change of title", () => {
    const source = lines(
      "## 12 U.S.C. § 5481 Definitions",
      "",
      "Text.",
      "",
      "## 12 U.S.C. § 5491 Bureau",
      "",
      "Text.",
      "",
      "## 15 U.S.C. § 1 Trusts",
      "",
      "Text.",
      "",
    );
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("a numbered heading whose title is a word, not a code, is still numbered", () => {
    const source = lines("## 40 Forest", "", "Text.", "", "## 42 Deposit", "", "Text.", "");
    assert.deepEqual(gapsOf(en, source), [["40", "42"]]);
  });

  it("a name that only starts with a code's letters is a title (40 CFRs to read)", () => {
    const source = lines("## 40 CFRs to read", "", "Text.", "", "## 42 USCAN reports", "", "Text.", "");
    assert.deepEqual(gapsOf(en, source), [["40", "42"]]);
  });

  it("titledCodeAt reads the lexicon's names after a title number, and only those", () => {
    const vocabulary = codeVocabulary(en.lexicons);
    assert.equal(titledCodeAt("CFR § 163.25 Forest", vocabulary), true);
    assert.equal(titledCodeAt("C.F.R. 163.25", vocabulary), true);
    assert.equal(titledCodeAt("U.S.C. § 1983", vocabulary), true);
    assert.equal(titledCodeAt("CFR", vocabulary), true);
    assert.equal(titledCodeAt("CFRs to read", vocabulary), false);
    assert.equal(titledCodeAt("RFC 1122", vocabulary), false);
    assert.equal(titledCodeAt("Forest CFR", vocabulary), false);
    assert.equal(titledCodeAt(" CFR", vocabulary), false);
    assert.equal(titledCodeAt("", vocabulary), false);
    assert.equal(titledCodeAt("CFR § 1", codeVocabulary({})), false);
  });

  it("a style guide's before-and-after example: a section heading that holds the same section again (plainlanguage.gov)", () => {
    const source = lines(
      "## Examples",
      "",
      "### § 163.25 Forest management deductions",
      "",
      "#### Dense text",
      "",
      "Forest management deductions shall not be withheld where the total consideration is less than $5,001.",
      "",
      "#### If-then table",
      "",
      "##### § 163.25 Will BIA withhold any forest management deductions?",
      "",
      "We will withhold a forest management deduction if the contract has a value of over $5,000.",
      "",
      "### § 163.17 Deposit with bid",
      "",
      "#### Dense text",
      "",
      "A deposit shall be made with each proposal for the purchase of Indian forest products.",
      "",
      "#### If-then table",
      "",
      "##### § 163.17 Must I make a deposit with my bid?",
      "",
      "You must include a deposit with your bid to buy Indian forest products.",
      "",
    );
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("section headings out of order are still reported when none holds its own number again", () => {
    const source = lines("### § 163.25 Forest management deductions", "", "Text.", "", "### § 163.17 Deposit with bid", "", "Text.", "");
    assert.deepEqual(gapsOf(en, source), [["Section 163.25", "Section 163.17"]]);
  });

  it("a section number written twice side by side is still reported", () => {
    const source = lines("## § 5 Scope", "", "Text.", "", "## § 5 Terms", "", "Text.", "", "## § 6 Notices", "", "Text.", "");
    assert.deepEqual(gapsOf(en, source), [["Section 5", "Section 5"]]);
  });

  it("a gap among sections that hold other numbers is still reported", () => {
    const source = lines("## § 1 Scope", "", "### § 1.1 Terms", "", "Text.", "", "## § 3 Notices", "", "Text.", "");
    assert.deepEqual(gapsOf(en, source), [["Section 1", "Section 3"]]);
  });

  it("a Japanese article heading that holds the same article again is left out of the sequence too", () => {
    const source = lines("## 第5条 目的", "", "### 第5条 （改正前）", "", "本文。", "", "## 第2条 定義", "", "本文。", "");
    assert.deepEqual(gapsOf(ja, source), []);
  });

  it("numberingBreaks: the left-out section is still in the tree, only its place in the sequence goes", () => {
    const tree = treeOf(en, lines("## § 7 A", "", "#### § 7 A again", "", "## § 2 B", ""));
    assert.deepEqual(numberedLabels(tree), ["Section 7", "Section 7", "Section 2"]);
    assert.deepEqual(numberingBreaks(tree), []);
  });
});

type NodeShape = { readonly kind?: StructureNode["kind"]; readonly address?: string; readonly ordinal?: number; readonly children?: StructureNode[] };

const nodeOf = ({ kind = "article", address = "", ordinal, children = [] }: NodeShape): StructureNode => ({
  kind,
  address,
  span: { start: 0, end: 1 },
  line: 1,
  attrs: {},
  children,
  ...(ordinal === undefined ? {} : { ordinal }),
});

describe("numbersQuotedInside", () => {
  it("marks every holder of its own number, and nothing else", () => {
    const inner = nodeOf({ address: "7", ordinal: 7 });
    const middle = nodeOf({ address: "7", ordinal: 7, children: [inner] });
    const outer = nodeOf({ address: "7", ordinal: 7, children: [nodeOf({ kind: "section", address: "h1" }), middle] });
    const other = nodeOf({ address: "8", ordinal: 8, children: [nodeOf({ address: "8.1", ordinal: 1 })] });
    const quoting = numbersQuotedInside(nodeOf({ kind: "doc", children: [outer, other] }));
    assert.deepEqual(
      [outer, middle, inner, other].map((node) => quoting.has(node)),
      [true, true, false, false],
    );
  });

  it("siblings with one number, another kind, an unnumbered node and an empty address are not holders", () => {
    const article = nodeOf({ address: "3", ordinal: 3, children: [nodeOf({ kind: "chapter", address: "3", ordinal: 3 }), nodeOf({ address: "3" })] });
    const blank = nodeOf({ address: "", ordinal: 1, children: [nodeOf({ address: "", ordinal: 1 })] });
    const doc = nodeOf({ kind: "doc", children: [article, nodeOf({ address: "3", ordinal: 3 }), blank] });
    assert.equal(numbersQuotedInside(doc).size, 0);
    assert.equal(numbersQuotedInside(nodeOf({ kind: "doc" })).size, 0);
  });

  it("a chain far deeper than the call stack, all with one number, is walked once without recursion", () => {
    const depth = 50_000;
    const chain = Array.from({ length: depth }).reduce<StructureNode>(
      (child) => nodeOf({ address: "1", ordinal: 1, children: [child] }),
      nodeOf({ address: "1", ordinal: 1 }),
    );
    assert.equal(numbersQuotedInside(nodeOf({ kind: "doc", children: [chain] })).size, depth);
  });
});

describe("numbers inside a quotation or code are not read (pinned)", () => {
  it("a quoted block's numbered lines open nothing", () => {
    const source = lines("> § 163.25 Forest management deductions", ">", "> § 163.17 Deposit with bid", "");
    assert.deepEqual(gapsOf(en, source), []);
    assert.deepEqual(numberedLabels(treeOf(en, source)), []);
  });

  it("a quoted Japanese statute opens nothing", () => {
    const source = lines("> 第1条 目的", ">", "> 第3条 定義", "");
    assert.deepEqual(numberedLabels(treeOf(ja, source)), []);
  });

  it("a code block's numbered lines open nothing", () => {
    const source = lines("```", "1.1 Scope", "1.3 Terms", "```", "");
    assert.deepEqual(numberedLabels(treeOf(en, source)), []);
  });
});
