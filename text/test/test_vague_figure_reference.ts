import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { vaguePointers } from "../packages/chaff/src/detectors/vague-figure-pointer.ts";
import { labelledKindsIn } from "../packages/chaff/src/figure-references.ts";
import { numbersClauses } from "../packages/chaff/src/structure/numbered-clauses.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, StructureNode } from "../packages/chaff/src/plugin.ts";

// vague-figure-reference: 「上記の図」「the table below」 in a document that numbers its figures or tables
// (JIS Z 8301:2019 10.6). Self-written text only.

const RULE = "vague-figure-reference";

const found = (adapter: LanguageAdapter, ...body: string[]): string[] =>
  runRules(buildDocument("t.md", ["# Report", "", ...body, ""].join("\n"), adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${finding.line}:${String(finding.values["matched"])}`);

describe("vague-figure-reference (ja)", () => {
  it("上記の図 and 下の表, when the document numbers its figures and tables", () => {
    assert.deepEqual(found(ja, "売上は上記の図のとおり伸び、費用は下の表にまとめた。", "", "図1　売上の推移", "", "表1　費用"), ["3:上記の図", "3:下の表"]);
  });

  it("only the kind the document numbers: a numbered figure does not make 下の表 checkable", () => {
    assert.deepEqual(found(ja, "上記の図と下の表を見てください。", "", "図1　売上の推移"), ["3:上記の図"]);
  });

  it("nothing in a document that numbers no figure or table", () => {
    assert.deepEqual(found(ja, "上記の図のとおり、売上は伸びた。"), []);
  });

  it("a pointer with its number, or inside a longer word, is not vague", () => {
    assert.deepEqual(found(ja, "上の図1のとおり伸びた。上の図表と、向上の図を見る。", "", "図1　売上の推移"), []);
  });

  it("a full-width number, or 第 and a kanji numeral, after a space names the figure", () => {
    assert.deepEqual(found(ja, "上の図 １と、下の表 第二を見る。", "", "図1　売上の推移", "", "表第二　費用"), []);
  });

  it("code is not read", () => {
    assert.deepEqual(found(ja, "図1のとおり伸びた。", "", "図1　売上の推移", "", "```", "上記の図", "```"), []);
  });
});

describe("vague-figure-reference (en)", () => {
  it("the figure below and the above table, in any case, when both are numbered", () => {
    assert.deepEqual(found(en, "The figure below shows sales. Costs are in the Above Table.", "", "Figure 1: Sales", "", "Table 1: Costs"), [
      "3:The figure below",
      "3:the Above Table",
    ]);
  });

  it("Figure 2 below names it, and a document with no numbered figures is not checked", () => {
    assert.deepEqual(found(en, "Figure 1 below shows sales.", "", "Figure 1: Sales"), []);
    assert.deepEqual(found(en, "The figure below shows sales."), []);
  });

  it("a number in any form a figure label takes, after a space, names the figure; a lower-case word does not", () => {
    const figures = ["", "Figure 1: Sales", "", "Figure 2: Costs", "", "Figure IV: Staff", "", "Figure A: Notes"];
    assert.deepEqual(found(en, "See the figure below 2, the figure above IV and the figure below A.", ...figures), []);
    assert.deepEqual(found(en, "The figure below a caption shows sales.", ...figures), ["3:The figure below"]);
  });

  it("the tablet below is not the table below", () => {
    assert.deepEqual(found(en, "Put the tablet below the screen.", "", "Table 1: Costs"), []);
  });
});

describe("vague-figure-reference: clauses (ja)", () => {
  it("以下の箇条 and 上記の箇条, when the document numbers its clauses", () => {
    assert.deepEqual(found(ja, "## 1 適用範囲", "", "この規格は、以下の箇条で定める。", "", "## 2 用語", "", "上記の箇条による。"), [
      "5:以下の箇条",
      "9:上記の箇条",
    ]);
  });

  it("第1条 numbers clauses as well", () => {
    assert.deepEqual(found(ja, "第1条（目的）", "本契約の条件は、後述の箇条による。", "", "第2条（期間）", "一年とする。"), ["4:後述の箇条"]);
  });

  it("nothing in a document that numbers no clause, or in a numbered list", () => {
    assert.deepEqual(found(ja, "以下の箇条を読む。"), []);
    assert.deepEqual(found(ja, "1. 電源を入れる。", "2. 以下の箇条を読む。"), []);
  });

  it("a pointer with its number, or inside a longer word, is not vague", () => {
    assert.deepEqual(found(ja, "## 1 適用範囲", "", "以下の箇条 2 と、以下の箇条書きを読む。", "", "## 2 用語"), []);
  });

  it("numbered clauses do not make 上記の図 checkable without a numbered figure", () => {
    assert.deepEqual(found(ja, "## 1 適用範囲", "", "上記の図のとおり。", "", "## 2 用語"), []);
  });
});

describe("vague-figure-reference: clauses (en)", () => {
  it("the clause below, in any case, when the document numbers its clauses", () => {
    assert.deepEqual(found(en, "## 1 Scope", "", "The Clause Below sets the terms.", "", "## 2 Payment", "", "Payment is due in 30 days."), [
      "5:The Clause Below",
    ]);
  });

  it("nothing in a document that numbers no clause", () => {
    assert.deepEqual(found(en, "The clause below sets the terms.", "", "## Payment", "", "Payment is due in 30 days."), []);
  });

  it("version headings in a changelog are not numbered clauses", () => {
    assert.deepEqual(found(en, "## 0.18.0 Release", "", "The clause below explains the migration.", "", "## 1.0 Release", "", "First release."), []);
  });
});

describe("numbersClauses — pure", () => {
  const node = (kind: StructureNode["kind"], children: StructureNode[] = [], address = "1"): StructureNode => ({
    kind,
    address,
    span: { start: 0, end: 0 },
    line: 1,
    attrs: {},
    children,
  });

  it("a numbered article or chapter anywhere in the tree", () => {
    assert.equal(numbersClauses(node("doc", [node("section", [node("article")])])), true);
    assert.equal(numbersClauses(node("doc", [node("chapter")])), true);
    assert.equal(numbersClauses(node("article")), true);
  });

  it("an article numbered only below the top level (a version, 0.18.0 or 1.0) is not a clause", () => {
    assert.equal(numbersClauses(node("doc", [node("article", [], "0.18.0"), node("article", [], "1.0")])), false);
    assert.equal(numbersClauses(node("doc", [node("article", [node("article", [], "2.1")], "2")])), true);
  });

  it("headings, items and leaves alone are not numbered clauses", () => {
    assert.equal(numbersClauses(node("doc", [node("section", [node("item"), node("reference"), node("definition")])])), false);
    assert.equal(numbersClauses(node("doc")), false);
  });
});

describe("vaguePointers — pure", () => {
  const pointers = [
    { pattern: "上の図", instead_of: "図" },
    { pattern: "the table below", instead_of: "Table" },
  ];

  it("finds each pointer of a labelled kind, in order of where it is", () => {
    assert.deepEqual(vaguePointers("the table below; 上の図", pointers, new Set(["図", "Table"])), [
      { offset: 0, written: "the table below", kind: "Table" },
      { offset: 17, written: "上の図", kind: "図" },
    ]);
  });

  it("finds nothing for a kind the document does not label, or with no pointers", () => {
    assert.deepEqual(vaguePointers("上の図", pointers, new Set(["Table"])), []);
    assert.deepEqual(vaguePointers("上の図", [], new Set(["図"])), []);
  });

  it("an entry with no kind points at nothing", () => {
    assert.deepEqual(vaguePointers("上の図", [{ pattern: "上の図" }], new Set(["図", ""])), []);
  });
});

describe("labelledKindsIn", () => {
  const words = {
    labels: [
      { word: "図", kind: "図" },
      { word: "表", kind: "表" },
    ],
    elsewhere: [],
    counters: [],
  };
  it("the kinds written at the start of a line, and not those only referred to", () => {
    assert.deepEqual([...labelledKindsIn("表1を見る。\n\n図1　推移\n", words)], ["図"]);
  });
});
